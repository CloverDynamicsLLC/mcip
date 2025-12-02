import { SearchResult } from "../../repository/interfaces/product.repository.interface";

export type FilterStrategy = "HARD_FILTER" | "SOFT_RANKING" | "HYBRID" | "NONE";

export interface FilterCriteria {
	brand?: string[];
	priceRange?: { min?: number; max?: number; currency?: string };
	attributes?: Record<string, string>;
	sortBy?: "price_asc" | "price_desc" | "relevance";
}

export interface FilterResult {
	filteredProductIds: string[];
	strategy: FilterStrategy;
	reasoning: string;
	appliedFilters?: FilterCriteria;
}

export interface ProductFilterService {
	/**
	 * Filters products using AI based on requirements and preferences in the query.
	 * Supports both hard filters (must-have requirements) and soft ranking (preferences).
	 * @param products - Array of search results from RAG
	 * @param query - User's original search query
	 * @returns FilterResult with product IDs, strategy used, and applied filters
	 */
	filterProducts(products: SearchResult[], query: string): Promise<FilterResult>;
}
