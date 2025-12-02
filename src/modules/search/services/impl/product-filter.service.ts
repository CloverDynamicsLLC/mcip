import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { SearchResult } from "../../../repository/interfaces/product.repository.interface";
import { FilterCriteria, FilterResult, ProductFilterService } from "../product-filter.service.interface";

const FilterResponseSchema = z.object({
	filteredProductIds: z
		.array(z.string())
		.describe("Array of product externalIds that match the requirements/preferences"),
	reasoning: z
		.string()
		.describe("Detailed explanation of the filtering strategy and why these products were selected"),
	strategy: z.enum(["HARD_FILTER", "SOFT_RANKING", "HYBRID", "NONE"]).describe("The filtering strategy applied"),
	appliedFilters: z
		.object({
			brand: z.array(z.string()).nullable().describe("Brand names extracted from query"),
			priceRange: z
				.object({
					min: z.number().nullable(),
					max: z.number().nullable(),
					currency: z.string().nullable(),
				})
				.nullable()
				.describe("Price range requirements"),
			attributes: z
				.array(z.object({ name: z.string(), value: z.string() }))
				.nullable()
				.describe("Specific attribute requirements"),
			sortBy: z
				.enum(["price_asc", "price_desc", "relevance"])
				.nullable()
				.describe("Sort order if ranking applied"),
		})
		.nullable()
		.describe("Structured information about filters applied"),
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

	async filterProducts(products: SearchResult[], query: string): Promise<FilterResult> {
		if (products.length === 0) {
			this.logger.log("No products to filter");

			return {
				filteredProductIds: [],
				strategy: "NONE",
				reasoning: "No products to filter",
			};
		}

		try {
			this.logger.log(`Filtering ${products.length} products for query: "${query}"`);

			// Prepare product data for AI
			const productData = products.map((result) => {
				let store = "Unknown";
				try {
					if (result.product.url) {
						const urlObj = new URL(result.product.url);
						store = urlObj.hostname.replace("www.", "");
					}
				} catch (e) {
					// ignore invalid URLs
				}

				return {
					externalId: result.product.externalId,
					title: result.product.title,
					description: result.product.description,
					price: result.product.price,
					attributes: result.product.attributes,
					url: result.product.url,
					store: store,
					variants: result.product.variants,
				};
			});

			const systemPrompt = `You are an intelligent product filtering assistant. Your job is to analyze user queries and apply appropriate filtering strategies.

## Filtering Strategies

**1. HARD_FILTER** - Use when query contains explicit, strict requirements:
   - Exact price thresholds: "under $1000", "above 500 EUR", "between 200-300 UAH"
   - Specific numeric attributes: "16GB RAM", "at least 512GB storage", "15 inch screen"
   - Exact specifications: "Intel i7 processor", "NVIDIA RTX graphics"
   - Boolean requirements: "with touchscreen", "must have SSD"

**2. SOFT_RANKING** - Use when query contains preferences that require ranking:
   - Superlatives: "cheapest", "most expensive", "best value", "lightest", "fastest"
   - Brand preferences: "Lenovo laptop", "Apple products", "Samsung phone"
   - General quality terms: "best", "top", "premium", "budget-friendly"
   - Comparative terms: "better performance", "more storage"

**3. HYBRID** - Use when query has BOTH hard filters AND soft ranking:
   - "cheapest laptop with 16GB RAM" → filter by RAM, then rank by price
   - "best gaming laptop under $2000" → filter by price, then rank by gaming specs

**4. NONE** - Use ONLY for completely generic queries with NO filtering intent:
   - "show me products"
   - "what do you have"
   - "browse laptops" (no specific criteria)

## Important Guidelines

- **Be aggressive in detecting filters** - Most user queries have some filtering intent
- **Extract brand names** - If a brand is mentioned (Lenovo, Dell, HP, Apple, etc.), filter by it
- **Understand price intent** - "cheapest", "budget", "affordable" → sort by price ascending
- **Support multiple currencies** - USD, EUR, UAH, etc.
- **Attribute matching** - Check product attributes for RAM, storage, processor, etc.
- **Variant awareness** - Check product variants for availability and specific configuration prices if needed.
- **Return top results for ranking** - For SOFT_RANKING, return top 5-10 products unless query specifies

## Response Format

- filteredProductIds: IDs of products that match
- reasoning: Clear explanation of your logic
- strategy: Which strategy you applied
- appliedFilters: Structured data about what filters were used`;

			const userPrompt = `User query: "${query}"

Products to filter:
${JSON.stringify(productData, null, 2)}

Analyze the query and apply the appropriate filtering strategy. Be intelligent and adaptive - most queries have filtering intent.`;

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

				return {
					filteredProductIds: [],
					strategy: "NONE",
					reasoning: "Failed to parse AI response",
				};
			}

			this.logger.log(
				`AI filtering result: ${response.filteredProductIds.length}/${products.length} products matched. ` +
					`Strategy: ${response.strategy}. Reasoning: ${response.reasoning}`
			);

			// Convert response to match FilterCriteria interface (handling nulls)
			const appliedFilters: FilterCriteria | undefined = response.appliedFilters
				? {
						brand: response.appliedFilters.brand ?? undefined,
						priceRange: response.appliedFilters.priceRange
							? {
									min: response.appliedFilters.priceRange.min ?? undefined,
									max: response.appliedFilters.priceRange.max ?? undefined,
									currency: response.appliedFilters.priceRange.currency ?? undefined,
								}
							: undefined,
						attributes: response.appliedFilters.attributes
							? response.appliedFilters.attributes.reduce(
									(acc, curr) => ({ ...acc, [curr.name]: curr.value }),
									{} as Record<string, string>
								)
							: undefined,
						sortBy: response.appliedFilters.sortBy ?? undefined,
					}
				: undefined;

			return {
				filteredProductIds: response.filteredProductIds,
				strategy: response.strategy,
				reasoning: response.reasoning,
				appliedFilters: appliedFilters,
			};
		} catch (error) {
			this.logger.error(`Error during AI filtering: ${error.message}`, error.stack);
			// On error, return NONE to fall back to RAG_ONLY
			return {
				filteredProductIds: [],
				strategy: "NONE",
				reasoning: `Error during AI filtering: ${error.message}`,
			};
		}
	}
}
