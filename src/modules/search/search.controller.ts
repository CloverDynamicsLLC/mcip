import { Controller, Get, Inject, Query } from "@nestjs/common";
import { SEARCH_SERVICE } from "../../constants/tokens";
import type { SearchService } from "./services/search.service.interface";
import { SearchRequestDto } from "./dto/search-request.dto";

@Controller("search")
export class SearchController {
	constructor(@Inject(SEARCH_SERVICE) private readonly searchService: SearchService) {}

	@Get()
	async search(@Query() request: SearchRequestDto) {
		const results = await this.searchService.search(request);

		return {
			count: results.length,
			items: results.map((item) => ({
				id: item.product.externalId,
				title: item.product.title,
				price: item.product.price,
				image: item.product.mainImage,
				score: item.score,
			})),
		};
	}
}
