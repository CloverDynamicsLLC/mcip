import { Controller, Get, Inject, Query } from "@nestjs/common";
import { AiProcessingService } from "../core/services/ai-processing.service";
import type { ProductRepository } from "../modules/repository/interfaces/product.repository.interface";
import { PRODUCT_REPOSITORY } from "../constants/tokens";

@Controller("search")
export class SearchController {
	constructor(
		@Inject(PRODUCT_REPOSITORY) private readonly productRepository: ProductRepository,
		private readonly aiService: AiProcessingService
	) {}

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

		// 1. Generate Vector from User Query
		// If query is empty (browsing mode), we might skip this or use a "dummy" vector
		let queryVector: number[] = [];
		if (query) {
			queryVector = await this.aiService.embedQuery(query);
		}

		// 2. Build Filters (Qdrant Syntax)
		// This allows us to drill down: "Shoes" (Vector) + "Category: Men" (Filter)
		const filterPayload: any = {};
		if (category) {
			filterPayload.must = [
				{
					key: "category",
					match: { value: category },
				},
			];
		}

		// 3. Execute Search
		// Note: If query is empty, Qdrant's 'scroll' API is better, but 'search' needs a vector.
		// For this MVP, we assume query is present.
		const results = await this.productRepository.search(
			queryVector,
			Object.keys(filterPayload).length > 0 ? filterPayload : undefined,
			parseInt(limit)
		);

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
