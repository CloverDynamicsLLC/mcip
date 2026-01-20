import { Injectable, Logger } from "@nestjs/common";
import { AgentState } from "../agent/agent.state";
import { BaseNode } from "./base.node";
import type { ProductRepository, SearchFilters } from "../../repository/interfaces/product.repository.interface";
import { SearchStatus } from "../schemas/extraction.schema";

/**
 * Node responsible for performing the final search with all filters including attributes
 */
@Injectable()
export class FinalSearchNode extends BaseNode {
	protected readonly logger = new Logger(FinalSearchNode.name);

	/** Maximum number of products to return */
	private readonly FINAL_SEARCH_LIMIT = 20;

	constructor(private readonly productRepository: ProductRepository) {
		super();
	}

	/**
	 * Execute the final search with all filters (basic + attributes)
	 */
	async execute(state: typeof AgentState.State) {
		const { category, brand, price } = state.extraction;
		const attributeFilters = state.attributeFilters;
		const queryVector = state.queryVector;

		// Build complete filters
		const filters = this.buildFilters(category, brand, price, attributeFilters);

		this.logger.log(`Executing final search with ${attributeFilters.length} attribute filters`);
		this.logger.debug(`Final filters: ${JSON.stringify(filters)}`);

		const results = await this.productRepository.hybridSearch(queryVector, filters, this.FINAL_SEARCH_LIMIT);

		let searchStatus: SearchStatus = "success";

		if (results.length === 0) {
			this.logger.warn("No products found with all filters");

			// Try fallback: search without attribute filters
			if (attributeFilters.length > 0) {
				this.logger.log("Attempting fallback search without attribute filters");
				const fallbackFilters = this.buildFilters(category, brand, price, []);
				const fallbackResults = await this.productRepository.hybridSearch(
					queryVector,
					fallbackFilters,
					this.FINAL_SEARCH_LIMIT
				);

				if (fallbackResults.length > 0) {
					this.logger.log(`Fallback search returned ${fallbackResults.length} products`);
					return {
						finalResults: fallbackResults,
						searchStatus: "partial" as SearchStatus,
					};
				}
			}

			searchStatus = "no_results";
		}

		this.logger.log(`Final search returned ${results.length} products`);

		return {
			finalResults: results,
			searchStatus,
		};
	}

	/**
	 * Build complete SearchFilters including attribute filters
	 */
	private buildFilters(
		category: string | null | undefined,
		brand: string | null | undefined,
		price: { amount: number; operator: string; maxAmount: number | null } | null | undefined,
		attributeFilters: { name: string; values: string[] }[]
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

		if (attributeFilters.length > 0) {
			filters.attributes = attributeFilters;
		}

		return filters;
	}
}
