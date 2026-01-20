import { Injectable, Logger } from "@nestjs/common";
import { AgentState } from "../agent/agent.state";
import { BaseNode } from "./base.node";
import type { ProductRepository, SearchFilters } from "../../repository/interfaces/product.repository.interface";
import type { VectorizationService } from "../../vectorization/services/vectorization.service.interface";

/**
 * Node responsible for performing initial search with basic filters (category, brand, price)
 * to retrieve products for attribute extraction
 */
@Injectable()
export class InitialSearchNode extends BaseNode {
	protected readonly logger = new Logger(InitialSearchNode.name);

	/** Number of products to retrieve for attribute analysis */
	private readonly INITIAL_SEARCH_LIMIT = 10;

	constructor(
		private readonly productRepository: ProductRepository,
		private readonly vectorizationService: VectorizationService
	) {
		super();
	}

	/**
	 * Execute initial search with extracted basic filters
	 */
	async execute(state: typeof AgentState.State) {
		const userQuery = this.getUserQuery(state);
		const { category, brand, price } = state.extraction;

		this.logger.log(`Performing initial search for: "${userQuery}"`);

		// Build filters from extraction
		const filters = this.buildFilters(category, brand, price);
		this.logger.debug(`Initial filters: ${JSON.stringify(filters)}`);

		// Vectorize the query
		const queryVector = await this.vectorizationService.embedString(userQuery);

		// Execute search
		const results = await this.productRepository.hybridSearch(
			queryVector,
			filters,
			this.INITIAL_SEARCH_LIMIT
		);

		if (results.length === 0) {
			this.logger.warn("No products found in initial search");
			return {
				queryVector,
				intermediateProducts: [],
				searchStatus: "no_results" as const,
			};
		}

		this.logger.log(`Found ${results.length} products in initial search`);

		return {
			queryVector,
			intermediateProducts: results.map((r) => r.product),
		};
	}

	/**
	 * Build SearchFilters from extracted criteria
	 */
	private buildFilters(
		category: string | null | undefined,
		brand: string | null | undefined,
		price: { amount: number; operator: string; maxAmount: number | null } | null | undefined
	): SearchFilters {
		const filters: SearchFilters = {};

		if (category) {
			filters.category = [category];
		}

		if (brand) {
			filters.brand = [brand];
		}

		if (price) {
			switch (price.operator) {
				case "lt":
					filters.priceMax = price.amount;
					break;
				case "gt":
					filters.priceMin = price.amount;
					break;
				case "eq":
					filters.priceMin = price.amount;
					filters.priceMax = price.amount;
					break;
				case "range":
					filters.priceMin = price.amount;
					if (price.maxAmount !== null) {
						filters.priceMax = price.maxAmount;
					}
					break;
			}
		}

		return filters;
	}
}
