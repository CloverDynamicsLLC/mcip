import { Inject, Injectable, Logger } from "@nestjs/common";
import { type ProductRepository, SearchResult } from "src/modules/repository/interfaces/product.repository.interface";
import { SearchService } from "../search.service.interface";
import { PRODUCT_REPOSITORY, VECTORIZATION_SERVICE } from "../../../../constants/tokens";
import type { VectorizationService } from "../../../vectorization/services/vectorization.service.interface";
import { SearchRequestDto } from "../../dto/search-request.dto";

@Injectable()
export class SearchServiceImpl implements SearchService {
	private readonly logger = new Logger(SearchServiceImpl.name);

	constructor(
		@Inject(PRODUCT_REPOSITORY) private readonly productRepository: ProductRepository,
		@Inject(VECTORIZATION_SERVICE) private readonly vectorizationService: VectorizationService
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

		this.logger.log(`Returning ${ragResults.length} RAG results`);
		return ragResults;
	}
}
