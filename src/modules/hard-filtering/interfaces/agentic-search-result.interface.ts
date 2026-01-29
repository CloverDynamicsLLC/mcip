import { SearchResult } from "../../repository/interfaces/product.repository.interface";
import { AttributeFilterSpec, AttributeMap, BrandValidationStatus, SearchStatus } from "../schemas/extraction.schema";

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
	/** Brands to include in results */
	brands?: string[];

	/** Brands to exclude from results */
	excludeBrands?: string[];

	/** Categories to include in results */
	categories?: string[];

	/** Categories to exclude from results */
	excludeCategories?: string[];

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

	/** Brand validation status - indicates if user's intended brands were found in store */
	brandValidationStatus?: BrandValidationStatus;
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
