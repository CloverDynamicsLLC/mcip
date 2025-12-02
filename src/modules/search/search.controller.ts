import { Controller, Get, Inject, Query } from "@nestjs/common";
import { SEARCH_SERVICE } from "../../constants/tokens";
import type { SearchService } from "./services/search.service.interface";
import { SearchRequestDto } from "./dto/search-request.dto";
import { SearchResponseDto } from "./dto/search-response.dto";

@Controller("search")
export class SearchController {
	constructor(@Inject(SEARCH_SERVICE) private readonly searchService: SearchService) {}

	@Get()
	async search(@Query() request: SearchRequestDto): Promise<SearchResponseDto> {
		const foundProducts = await this.searchService.search(request);

		// Extract filtering status and result from the array (hacky but simple)
		const filteringStatus = (foundProducts as any).__filteringStatus || "RAG_ONLY";
		const filterResult = (foundProducts as any).__filterResult;

		return {
			meta: {
				count: foundProducts.length,
				take: request.take ?? 10,
				skip: request.skip ?? 0,
				q: request.q ?? '',
				filteringStatus,
				appliedFilters: filterResult?.appliedFilters,
			},
			items: foundProducts.map((item) => ({
				...item.product,
				score: item.score,
			})),
		};
	}
}
