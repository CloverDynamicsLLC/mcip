import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { SearchResult } from "../../../repository/interfaces/product.repository.interface";
import { ProductFilterService } from "../product-filter.service.interface";

const FilterResponseSchema = z.object({
	filteredProductIds: z.array(z.string()).describe("Array of product externalIds that match the strict requirements"),
	reasoning: z.string().describe("Brief explanation of why these products were selected or why filtering was not applied"),
});

@Injectable()
export class ProductFilterServiceImpl implements ProductFilterService {
	private readonly logger = new Logger(ProductFilterServiceImpl.name);
	private readonly openai: OpenAI;

	constructor(private readonly configService: ConfigService) {
		const apiKey = this.configService.get<string>("OPENAI_API_KEY");
		if (!apiKey) {
			throw new Error("OPENAI_API_KEY is not configured");
		}
		this.openai = new OpenAI({ apiKey });
	}

	async filterProducts(products: SearchResult[], query: string): Promise<string[]> {
		if (products.length === 0) {
			return [];
		}

		try {
			this.logger.log(`Filtering ${products.length} products for query: "${query}"`);

			// Prepare product data for AI
			const productData = products.map((result) => ({
				externalId: result.product.externalId,
				title: result.product.title,
				brand: result.product.brand,
				price: result.product.price,
				category: result.product.category,
				description: result.product.description,
				attributes: result.product.attributes,
			}));

			const systemPrompt = `You are a product filtering assistant. Your job is to analyze the user's query and filter products based on STRICT requirements like:
- Price thresholds (e.g., "above $1000", "under 500 UAH", "between 200-300 EUR")
- Specific brands (e.g., "Lenovo", "Apple", "Samsung")
- Specific attributes (e.g., "with 16GB RAM", "gaming laptop")
- Availability requirements

If the query contains such strict requirements, return only the product IDs that match ALL requirements.
If the query is general (e.g., "laptop for work", "good smartphone") with no strict filters, return an EMPTY array.

Be strict and precise - only filter when you detect clear, specific requirements.`;

			const userPrompt = `User query: "${query}"

Products to filter:
${JSON.stringify(productData, null, 2)}

Analyze the query and return the filtered product IDs. If no strict requirements are detected, return an empty array.`;

			const completion = await this.openai.chat.completions.parse({
				model: "gpt-4o-mini",
				messages: [
					{ role: "system", content: systemPrompt },
					{ role: "user", content: userPrompt },
				],
				response_format: zodResponseFormat(FilterResponseSchema, "filter_response"),
			});


			const response = completion.choices[0].message.parsed;

			if (!response) {
				this.logger.warn("Failed to parse AI response");
				return [];
			}

			this.logger.log(`AI filtering result: ${response.filteredProductIds.length} products matched. Reasoning: ${response.reasoning}`);

			return response.filteredProductIds;
		} catch (error) {
			this.logger.error(`Error during AI filtering: ${error.message}`, error.stack);
			// On error, return empty array to fall back to RAG_ONLY
			return [];
		}
	}
}
