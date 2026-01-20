import { Injectable, Logger } from "@nestjs/common";
import { AgentState } from "../agent/agent.state";
import { BaseNode } from "./base.node";
import type { ProductRepository } from "../../repository/interfaces/product.repository.interface";
import { SearchStatus } from "../schemas/extraction.schema";
import { FilterBuilder } from "../utils/filter-builder";

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
		const { attributeFilters, queryVector, extraction } = state;

		// Build complete filters using shared FilterBuilder
		const filters = FilterBuilder.fromCriteria(extraction, attributeFilters);

		this.logger.log(`Executing final search with ${attributeFilters.length} attribute filters`);
		this.logger.debug(`Final filters: ${JSON.stringify(filters)}`);

		const results = await this.productRepository.hybridSearch(queryVector, filters, this.FINAL_SEARCH_LIMIT);

		let searchStatus: SearchStatus = "success";

		if (results.length === 0) {
			this.logger.warn("No products found with all filters");

			// Try fallback: search without attribute filters
			if (attributeFilters.length > 0) {
				this.logger.log("Attempting fallback search without attribute filters");
				const fallbackFilters = FilterBuilder.withoutAttributes(filters);
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
}
