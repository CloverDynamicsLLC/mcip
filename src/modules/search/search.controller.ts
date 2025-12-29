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
		const result = await this.searchService.search(request);

		return {
			meta: {
				count: result.results.length,
				take: request.take ?? 10,
				skip: request.skip ?? 0,
				q: request.q ?? "",
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
