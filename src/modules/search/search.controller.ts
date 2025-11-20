import { Controller, Get, Inject, Query } from "@nestjs/common";
import { SEARCH_SERVICE } from "../../constants/tokens";
import type { SearchService } from "./services/search.service.interface";

@Controller("search")
export class SearchController {
	constructor(@Inject(SEARCH_SERVICE) private readonly searchService: SearchService) {}

	@Get()
	async search(
		@Query("q") query: string,
		@Query("limit") limit: string = "20",
		@Query("category") category?: string
	) {
		if (!query) {
			// Fallback: Just list items (Scroll API)
			// You need to add a scroll() method to QdrantService
			// For now, let's require a query.
			return { message: "Please type something to search" };
		}

		const results = await this.searchService.search(query);

		// 4. Return Frontend-Ready Response
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
