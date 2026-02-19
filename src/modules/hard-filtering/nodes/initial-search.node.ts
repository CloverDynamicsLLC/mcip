import { Injectable, Logger } from "@nestjs/common";
import { AgentState } from "../agent/agent.state";
import { BaseNode } from "./base.node";
import type { ProductRepository } from "../../repository/interfaces/product.repository.interface";
import type { VectorizationService } from "../../vectorization/services/vectorization.service.interface";
import { FilterBuilder } from "../utils/filter-builder";

/**
 * Node responsible for performing search with basic filters (category, brand, price)
 * and returning results for LLM verification
 */
@Injectable()
export class InitialSearchNode extends BaseNode {
	protected readonly logger = new Logger(InitialSearchNode.name);

	/** Number of products to retrieve for LLM verification */
	private readonly SEARCH_LIMIT = 20;

	constructor(
		private readonly productRepository: ProductRepository,
		private readonly vectorizationService: VectorizationService
	) {
		super();
	}

	/**
	 * Execute search with extracted basic filters
	 */
	async execute(state: typeof AgentState.State) {
		const userQuery = this.getUserQuery(state);

		this.logger.log(`Performing search for: "${userQuery}"`);

		// Build filters from extraction using shared FilterBuilder
		const filters = FilterBuilder.fromCriteria(state.extraction);
		this.logger.debug(`Filters: ${JSON.stringify(filters)}`);
		this.logger.debug(
			`Extraction state - brands: [${state.extraction.brands?.join(", ") ?? "none"}], ` +
				`categories: [${state.extraction.categories?.join(", ") ?? "none"}]`
		);

		// Vectorize the query
		const queryVector = await this.vectorizationService.embedString(userQuery);

		// Execute search
		let results = await this.productRepository.hybridSearch(queryVector, filters, this.SEARCH_LIMIT);

		if (results.length === 0 && Object.keys(filters).length > 0) {
			this.logger.warn("Hybrid search returned 0 results, falling back to vector search");
			results = await this.productRepository.search(queryVector, this.SEARCH_LIMIT);
		}

		if (results.length === 0) {
			this.logger.warn("No products found in search");
			return {
				queryVector,
				intermediateProducts: [],
				finalResults: [],
				searchStatus: "no_results" as const,
			};
		}

		this.logger.log(`Found ${results.length} products`);

		return {
			queryVector,
			intermediateProducts: results.map((r) => r.product),
			finalResults: results,
		};
	}
}
