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
	private readonly openai: OpenAI;

	constructor(private readonly configService: ConfigService) {
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
		this.logger.debug(`Available brands (${availableBrands.length}): ${availableBrands.join(", ")}`);
		this.logger.debug(`Available categories (${availableCategories.length}): ${availableCategories.join(", ")}`);

		const FilterSchema = z.object({
			brand: z
				.array(z.string())
				.nullish()
				.describe("List of brands to INCLUDE. MUST be from the available list of brands."),
			excludeBrand: z
				.array(z.string())
				.nullish()
				.describe(
					"List of brands to EXCLUDE (e.g., 'but not Nike', 'except Apple', 'without Samsung'). MUST be from the available list of brands."
				),
			category: z
				.array(z.string())
				.nullish()
				.describe("List of categories to INCLUDE. MUST be from the available list of categories."),
			excludeCategory: z
				.array(z.string())
				.nullish()
				.describe(
					"List of categories to EXCLUDE (e.g., 'but not laptops', 'except phones'). MUST be from the available list of categories."
				),
			priceMin: z.number().nullish().describe("Minimum price extracted from query (e.g. 'over $100')"),
			priceMax: z.number().nullish().describe("Maximum price extracted from query (e.g. 'under $500')"),
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
              Extract filters and clean the search query. You MUST detect both INCLUSION and EXCLUSION patterns.

              Available Brands: ${availableBrands.join(", ")}
              Available Categories: ${availableCategories.join(", ")}

              Rules:
              1. INCLUSION: Detect brands/categories the user wants (e.g., "Nike shoes", "Apple laptops")
              2. EXCLUSION: Detect brands/categories the user wants to EXCLUDE using patterns like:
                 - "but not [brand]"
                 - "except [brand]"
                 - "without [brand]"
                 - "no [brand]"
                 - "everything except [brand]"
                 - "all brands but [brand]"
              3. Map all brand/category mentions to EXACT strings from the available lists.
              4. Extract price ranges (greater than, less than, between).
              5. 'searchQuery' should be the remaining keywords after extracting all filters.
              
              Examples:
              - "Nike shoes" → brand: ["Nike"], searchQuery: "shoes"
              - "shoes but not Nike" → excludeBrand: ["Nike"], searchQuery: "shoes"
              - "laptops except Apple" → category: ["Laptops"], excludeBrand: ["Apple"], searchQuery: ""
              - "phones under $500 no Samsung" → category: ["Phones"], excludeBrand: ["Samsung"], priceMax: 500, searchQuery: ""
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

			// Log what LLM extracted (before validation)
			this.logger.log(
				`LLM extracted - Brands: [${result.brand?.join(", ") || "none"}], ExcludeBrands: [${result.excludeBrand?.join(", ") || "none"}]`
			);
			this.logger.log(
				`LLM extracted - Categories: [${result.category?.join(", ") || "none"}], ExcludeCategories: [${result.excludeCategory?.join(", ") || "none"}]`
			);
			this.logger.log(
				`LLM extracted - PriceMin: ${result.priceMin ?? "none"}, PriceMax: ${result.priceMax ?? "none"}`
			);

			// Validate extracted values against available lists (double check)
			const validBrands = result.brand?.filter((b) => availableBrands.includes(b)) || [];
			const validExcludeBrands = result.excludeBrand?.filter((b) => availableBrands.includes(b)) || [];
			const validCategories = result.category?.filter((c) => availableCategories.includes(c)) || [];
			const validExcludeCategories = result.excludeCategory?.filter((c) => availableCategories.includes(c)) || [];

			// Log validation results if any were filtered out
			if (result.brand?.length !== validBrands.length) {
				const invalid = result.brand?.filter((b) => !availableBrands.includes(b)) || [];
				this.logger.warn(`Invalid brands filtered out: [${invalid.join(", ")}]`);
			}
			if (result.excludeBrand?.length !== validExcludeBrands.length) {
				const invalid = result.excludeBrand?.filter((b) => !availableBrands.includes(b)) || [];
				this.logger.warn(`Invalid exclude brands filtered out: [${invalid.join(", ")}]`);
			}
			if (result.category?.length !== validCategories.length) {
				const invalid = result.category?.filter((c) => !availableCategories.includes(c)) || [];
				this.logger.warn(`Invalid categories filtered out: [${invalid.join(", ")}]`);
			}
			if (result.excludeCategory?.length !== validExcludeCategories.length) {
				const invalid = result.excludeCategory?.filter((c) => !availableCategories.includes(c)) || [];
				this.logger.warn(`Invalid exclude categories filtered out: [${invalid.join(", ")}]`);
			}

			this.logger.log(
				`Final validated filters - Brands: [${validBrands.join(", ") || "none"}], Categories: [${validCategories.join(", ") || "none"}]`
			);

			return {
				brand: validBrands.length > 0 ? validBrands : undefined,
				excludeBrand: validExcludeBrands.length > 0 ? validExcludeBrands : undefined,
				category: validCategories.length > 0 ? validCategories : undefined,
				excludeCategory: validExcludeCategories.length > 0 ? validExcludeCategories : undefined,
				priceMin: result.priceMin ?? undefined,
				priceMax: result.priceMax ?? undefined,
				searchQuery: result.searchQuery || query,
			};
		} catch (error) {
			this.logger.error(`Error extracting filters: ${error.message}`);
			// Fallback: return an original query with no filters
			return { searchQuery: query };
		}
	}
}
