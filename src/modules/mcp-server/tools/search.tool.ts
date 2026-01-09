import { Inject, Injectable } from "@nestjs/common";
import { Tool } from "@rekog/mcp-nest";
import { z } from "zod";
import { SEARCH_SERVICE } from "../../../constants/tokens";
import type { SearchService } from "../../search/services/search.service.interface";

@Injectable()
export class SearchTool {
	constructor(@Inject(SEARCH_SERVICE) private readonly searchService: SearchService) {}

	@Tool({
		name: "search-tool",
		description: "Call it when user ask to search a product",
		parameters: z.object({
			query: z.string().describe("User query to search some products"),
		}),
	})
	async search({ query }) {
		const result = await this.searchService.search({ q: query });

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
