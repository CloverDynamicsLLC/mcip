import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OpenAI } from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { FeatureExtractionService } from "../feature-extraction.service.interface";
import { ExtractedFilters } from "../../interfaces/extracted-filters.interface";

@Injectable()
export class FeatureExtractionServiceImpl implements FeatureExtractionService {
	private readonly logger = new Logger(FeatureExtractionServiceImpl.name);
	private openai: OpenAI;

	constructor(private configService: ConfigService) {
		this.openai = new OpenAI({
			apiKey: this.configService.get<string>("OPENAI_API_KEY"),
		});
	}

	async extractFilters(
		query: string,
		availableBrands: string[],
		availableCategories: string[]
	): Promise<ExtractedFilters> {
		this.logger.log(`Extracting filters for query: "${query}"`);

		const FilterSchema = z.object({
			brand: z
				.array(z.string())
				.optional()
				.describe("List of brands identified in the query. MUST be from the available list of brands."),
			category: z
				.array(z.string())
				.optional()
				.describe("List of categories identified in the query. MUST be from the available list of categories."),
			priceMin: z.number().optional().describe("Minimum price extracted from query (e.g. 'over $100')"),
			priceMax: z.number().optional().describe("Maximum price extracted from query (e.g. 'under $500')"),
			searchQuery: z
				.string()
				.describe(
					"The core search query with brand/price terms removed. E.g. 'Nike shoes under 100' -> 'shoes' (if category is generic, keep it as query)"
				),
		});

		try {
			const completion = await this.openai.chat.completions.parse({
				model: "gpt-4o-mini",
				messages: [
					{
						role: "system",
						content: `
              You are a search query understander for an e-commerce store.
              Extract filters and clean the search query.

              Available Brands: ${availableBrands.join(", ")}
              Available Categories: ${availableCategories.join(", ")}

              Rules:
              1. Map brand mentions to the EXACT string from Available Brands.
              2. Map category intent to the EXACT string from Available Categories.
              3. Extract price ranges (greater than, less than, between).
              4. 'searchQuery' should be the remaining keywords after extracting filters. If the whole query was filters (e.g. 'phones'), 'searchQuery' should be empty or generic like 'smartphone'.
            `,
					},
					{
						role: "user",
						content: query,
					},
				],
				response_format: zodResponseFormat(FilterSchema, "filters"),
			});

			const result = completion.choices[0].message.parsed;

			if (!result) {
				return { searchQuery: query };
			}

			// Validate extracted values against available lists (double check)
			const validBrands = result.brand?.filter((b) => availableBrands.includes(b)) || [];
			const validCategories = result.category?.filter((c) => availableCategories.includes(c)) || [];

			return {
				brand: validBrands.length > 0 ? validBrands : undefined,
				category: validCategories.length > 0 ? validCategories : undefined,
				priceMin: result.priceMin,
				priceMax: result.priceMax,
				searchQuery: result.searchQuery || query,
			};
		} catch (error) {
			this.logger.error(`Error extracting filters: ${error.message}`);
			// Fallback: return an original query with no filters
			return { searchQuery: query };
		}
	}
}
