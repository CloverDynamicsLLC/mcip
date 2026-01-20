import { UnifiedProduct } from "../../../domain/product.schema";

export interface SearchResult {
	score: number;
	product: UnifiedProduct;
}

/**
 * Single attribute filter condition
 */
export interface AttributeFilter {
	name: string;
	values: string[];
}

/**
 * Filters for hybrid search combining vector similarity with hard filters
 */
export interface SearchFilters {
	brand?: string[];
	excludeBrand?: string[];
	category?: string[];
	excludeCategory?: string[];
	priceMin?: number;
	priceMax?: number;
	/** Attribute-based filters for product specifications */
	attributes?: AttributeFilter[];
}

export interface ProductRepository {
	/**
	 * Saves the product and its vector.
	 */
	save(product: UnifiedProduct, vector: number[]): Promise<void>;

	/**
	 * Searches by vector similarity AND applies filters.
	 */
	search(queryVector: number[], limit?: number, offset?: number): Promise<SearchResult[]>;

	/**
	 * Hybrid search with hard filtering
	 */
	hybridSearch(
		queryVector: number[],
		filters: SearchFilters,
		limit?: number,
		offset?: number
	): Promise<SearchResult[]>;

	/**
	 * Get available values for filtering
	 */
	getFacetValues(key: string, limit?: number): Promise<string[]>;

	/**
	 * Deletes a product by ID.
	 */
	delete(id: string): Promise<void>;

	/**
	 * Recreate all payload indexes.
	 */
	recreateIndexes(): Promise<void>;
}
