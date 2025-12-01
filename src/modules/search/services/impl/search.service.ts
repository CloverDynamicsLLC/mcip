import { Inject, Injectable, Logger } from "@nestjs/common";
import { type ProductRepository, SearchResult } from "src/modules/repository/interfaces/product.repository.interface";
import { SearchService } from "../search.service.interface";
import { PRODUCT_FILTER_SERVICE, PRODUCT_REPOSITORY, VECTORIZATION_SERVICE } from "../../../../constants/tokens";
import type { VectorizationService } from "../../../vectorization/services/vectorization.service.interface";
import type { ProductFilterService } from "../product-filter.service.interface";
import { SearchRequestDto } from "../../dto/search-request.dto";

export interface SearchServiceResult {
	products: SearchResult[];
	filteringStatus: "AI_FILTERED" | "RAG_ONLY";
}

@Injectable()
export class SearchServiceImpl implements SearchService {
	private readonly logger = new Logger(SearchServiceImpl.name);

	constructor(
		@Inject(PRODUCT_REPOSITORY) private readonly productRepository: ProductRepository,
		@Inject(VECTORIZATION_SERVICE) private readonly vectorizationService: VectorizationService,
		@Inject(PRODUCT_FILTER_SERVICE) private readonly productFilterService: ProductFilterService
	) {}

	async search({ q, take, skip }: SearchRequestDto): Promise<SearchResult[]> {
		this.logger.log(`Searching for: ${q}`);

		if (!q) return [];

		let queryVector: number[] = await this.vectorizationService.embedString(q);

		// Skip for now, probably will be added later (required time and effort to implement and test)
		const filterPayload: any = {};

		const ragResults = await this.productRepository.search(
			queryVector,
			Object.keys(filterPayload).length > 0 ? filterPayload : undefined,
			take,
			skip
		);

		// If no RAG results, return empty
		if (ragResults.length === 0) {
			return [];
		}

		// Apply AI filtering
		const filteredProductIds = await this.productFilterService.filterProducts(ragResults, q);

		// If AI returned 1+ products, return only those
		if (filteredProductIds.length > 0) {
			this.logger.log(`AI filtered ${filteredProductIds.length} products from ${ragResults.length} RAG results`);
			const filtered = ragResults.filter((result) => filteredProductIds.includes(result.product.externalId));
			// Store filtering status in a way the controller can access
			(filtered as any).__filteringStatus = "AI_FILTERED";
			return filtered;
		}

		// Otherwise return all RAG results
		this.logger.log(`No AI filtering applied, returning all ${ragResults.length} RAG results`);
		(ragResults as any).__filteringStatus = "RAG_ONLY";
		return ragResults;
	}
}
