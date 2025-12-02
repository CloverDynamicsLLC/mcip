import { Inject, Injectable, Logger } from "@nestjs/common";
import { type ProductRepository, SearchResult } from "src/modules/repository/interfaces/product.repository.interface";
import { SearchService } from "../search.service.interface";
import { PRODUCT_FILTER_SERVICE, PRODUCT_REPOSITORY, VECTORIZATION_SERVICE } from "../../../../constants/tokens";
import type { VectorizationService } from "../../../vectorization/services/vectorization.service.interface";
import type { FilterResult, ProductFilterService } from "../product-filter.service.interface";
import { SearchRequestDto } from "../../dto/search-request.dto";

export interface SearchServiceResult {
	products: SearchResult[];
	filteringStatus: "AI_FILTERED" | "AI_RANKED" | "RAG_ONLY";
	filterResult?: FilterResult;
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

		if (!q) {
			this.logger.warn("No query provided, returning empty result");
			return [];
		}

    // 1. Embed query into vector space
		const queryVector: number[] = await this.vectorizationService.embedString(q);

    // 2. Search in RAG index (using OpenAI's Embeddings API)
		const ragResults = await this.productRepository.search(queryVector, take, skip);

		// 3. If no RAG results, return empty
		if (ragResults.length === 0) {
      this.logger.log("No RAG results found, returning empty result");
			return [];
		}

    // 4. Filter RAG results using AI (Waterfall approach)
		const filterResult = await this.productFilterService.filterProducts(ragResults, q);

		// Determine filtering status based on strategy
		let filteringStatus: "AI_FILTERED" | "AI_RANKED" | "RAG_ONLY";

		if (filterResult.strategy === "HARD_FILTER") {
			filteringStatus = "AI_FILTERED";
		} else if (filterResult.strategy === "SOFT_RANKING" || filterResult.strategy === "HYBRID") {
			filteringStatus = "AI_RANKED";
		} else {
			filteringStatus = "RAG_ONLY";
		}

		// If strategy is NONE, fallback to returning all RAG results
		if (filterResult.strategy === "NONE") {
			this.logger.log(`No AI filtering applied (strategy NONE), returning all ${ragResults.length} RAG results`);
			(ragResults as any).__filteringStatus = "RAG_ONLY";
			return ragResults;
		}

		// If AI applied a strategy (HARD_FILTER, SOFT_RANKING, HYBRID), return the filtered results
		// Even if the result is empty (meaning no products matched the strict filters)
		this.logger.log(
			`AI ${filteringStatus}: ${filterResult.filteredProductIds.length}/${ragResults.length} products. ` +
				`Reasoning: ${filterResult.reasoning}`
		);

		const filtered = ragResults.filter((result) =>
			filterResult.filteredProductIds.includes(result.product.externalId)
		);

		// Store filtering status and result in a way the controller can access
		(filtered as any).__filteringStatus = filteringStatus;
		(filtered as any).__filterResult = filterResult;

		return filtered;
	}
}
