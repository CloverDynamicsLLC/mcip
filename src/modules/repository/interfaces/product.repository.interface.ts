import { UnifiedProduct } from "../../../domain/product.schema";

export interface SearchResult {
	score: number;
	product: UnifiedProduct;
}

export interface ProductRepository {
	/**
	 * Saves the product and its vector.
	 */
	save(product: UnifiedProduct, vector: number[]): Promise<void>;

	/**
	 * Searches by vector similarity AND applies filters.
	 */
	search(queryVector: number[], filter?: any, limit?: number, offset?: number): Promise<SearchResult[]>;

	/**
	 * Deletes a product by ID.
	 */
	delete(id: string): Promise<void>;
}
