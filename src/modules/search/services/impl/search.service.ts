import { Inject, Injectable, Logger } from "@nestjs/common";
import { type ProductRepository, SearchResult } from "src/modules/repository/interfaces/product.repository.interface";
import { SearchService } from "../search.service.interface";
import { FEATURE_EXTRACTION_SERVICE, PRODUCT_REPOSITORY, VECTORIZATION_SERVICE } from "../../../../constants/tokens";
import type { VectorizationService } from "../../../vectorization/services/vectorization.service.interface";
import type { FeatureExtractionService } from "../feature-extraction.service.interface";
import { SearchRequestDto } from "../../dto/search-request.dto";
import { FilteringStatus } from "../../dto/search-response.dto";
import { SearchServiceResult } from "../../interfaces/search-service-result.interface";

@Injectable()
export class SearchServiceImpl implements SearchService {
	private readonly logger = new Logger(SearchServiceImpl.name);

	constructor(
		@Inject(PRODUCT_REPOSITORY) private readonly productRepository: ProductRepository,
		@Inject(VECTORIZATION_SERVICE) private readonly vectorizationService: VectorizationService,
		@Inject(FEATURE_EXTRACTION_SERVICE) private readonly featureExtractionService: FeatureExtractionService
	) {}

	async search({ q, take, skip }: SearchRequestDto): Promise<SearchServiceResult> {
		this.logger.log(`Searching for: ${q}`);

		if (!q) {
			this.logger.warn("No query provided, returning empty result");
			return {
				results: [],
				filteringStatus: FilteringStatus.RAG_ONLY,
			};
		}

		// 0. Get available facets (brands, categories) for LLM context
		const facets = await this.productRepository.getFacets();

		// 1. Extract filters from query
		const extracted = await this.featureExtractionService.extractFilters(q, facets.brands, facets.categories);

		const hasFilters =
			extracted.brand ||
			extracted.excludeBrand ||
			extracted.category ||
			extracted.excludeCategory ||
			extracted.priceMin !== undefined ||
			extracted.priceMax !== undefined;
		const cleanQuery = extracted.searchQuery;

		this.logger.log(`Extracted filters: ${JSON.stringify(extracted)}`);

		// 2. Embed query into vector space (use a clean query if filters exist, otherwise original)
		const queryToEmbed = hasFilters && cleanQuery ? cleanQuery : q;
		const queryVector: number[] = await this.vectorizationService.embedString(queryToEmbed);

		let results: SearchResult[];
		let filteringStatus: FilteringStatus = FilteringStatus.RAG_ONLY;

		// 3. Hybrid Search
		if (hasFilters) {
			this.logger.log(`Performing Hybrid Search with filters:`);
			this.logger.log({
				brand: extracted.brand,
				excludeBrand: extracted.excludeBrand,
				category: extracted.category,
				excludeCategory: extracted.excludeCategory,
				priceMin: extracted.priceMin,
				priceMax: extracted?.priceMax === 0 ? undefined : extracted.priceMax,
			});
			results = await this.productRepository.hybridSearch(
				queryVector,
				{
					brand: extracted.brand,
					excludeBrand: extracted.excludeBrand,
					category: extracted.category,
					excludeCategory: extracted.excludeCategory,
					priceMin: extracted.priceMin,
					priceMax: extracted?.priceMax === 0 ? undefined : extracted.priceMax,
				},
				take,
				skip
			);
			filteringStatus = FilteringStatus.AI_FILTERED;
		} else {
			// 4. Standard RAG Search
			this.logger.log(`Performing Standard RAG Search...`);
			results = await this.productRepository.search(queryVector, take, skip);
		}

		if (results.length === 0) {
			this.logger.warn("No results found");
			return {
				results: [],
				filteringStatus: FilteringStatus.RAG_ONLY,
			};
		}

		this.logger.log(`Returning ${results.length} results`);

		return {
			results,
			filteringStatus,
			appliedFilters: {
				brand: extracted.brand,
				excludedBrand: extracted.excludeBrand,
				priceRange:
					extracted.priceMin || extracted.priceMax
						? { min: extracted.priceMin, max: extracted.priceMax, currency: "UAH" }
						: undefined,
				attributes: extracted.category ? { category: extracted.category.join(", ") } : undefined,
				excludedAttributes: extracted.excludeCategory
					? { category: extracted.excludeCategory.join(", ") }
					: undefined,
			},
		};
	}
}
