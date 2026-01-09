import { Inject, Injectable } from "@nestjs/common";
import { Tool } from "@rekog/mcp-nest";
import { z } from "zod";
import { SEARCH_SERVICE } from "../../../constants/tokens";
import type { SearchService } from "../../search/services/search.service.interface";

@Injectable()
export class SearchTool {
	constructor(@Inject(SEARCH_SERVICE) private readonly searchService: SearchService) {}

	@Tool({
		name: "search-products",
		description: "Searches the product catalog based on a query",
		parameters: z.object({
			query: z.string().describe("User query for searching"),
		}),
	})
	async searchProducts({ query }) {
		const result = await this.searchService.search({ q: query });

		if (!result.results || result.results.length === 0) {
			return {
				content: [{ type: "text", text: `No products found for query: "${query}"` }],
			};
		}

		return {
			meta: {
				count: result.results.length,
				query: query ?? "",
				filteringStatus: result.filteringStatus,
				appliedFilters: result.appliedFilters,
			},
			items: result.results.map((item) => ({
				...item.product,
				score: item.score,
			})),
		};
	}
}
