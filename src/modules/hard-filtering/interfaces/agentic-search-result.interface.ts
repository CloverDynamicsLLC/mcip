import { SearchResult } from "../../repository/interfaces/product.repository.interface";
import { AttributeFilterSpec, AttributeMap, SearchStatus } from "../schemas/extraction.schema";

/**
 * Complete result from the agentic search workflow
 */
export interface AgenticSearchResult {
	/** Final search results */
	products: SearchResult[];

	/** Search status indicator */
	status: SearchStatus;

	/** All applied filters */
	appliedFilters: AppliedFilters;

	/** Discovered attributes from intermediate search (for transparency) */
	discoveredAttributes?: AttributeMap[];

	/** LLM reasoning for attribute mapping (for debugging) */
	reasoning?: string;
}

/**
 * Filters that were applied during search
 */
export interface AppliedFilters {
	/** Extracted brand filter */
	brand?: string;

	/** Extracted category filter */
	category?: string;

	/** Extracted price condition */
	price?: {
		amount: number;
		operator: string;
		maxAmount?: number | null;
	};

	/** Sorting preference */
	sorting?: {
		field: string;
		order: string;
	};

	/** Attribute filters from LLM mapping */
	attributes?: AttributeFilterSpec[];
}

/**
 * Input for the agentic search workflow
 */
export interface AgenticSearchInput {
	/** User search query */
	query: string;

	/** Optional pre-fetched available attributes context */
	availableAttributes?: {
		categories?: string[];
		brands?: string[];
	};
}
