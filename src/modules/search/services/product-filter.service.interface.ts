import { SearchResult } from "../../repository/interfaces/product.repository.interface";

export interface ProductFilterService {
	/**
	 * Filters products using AI based on strict requirements in the query.
	 * @param products - Array of search results from RAG
	 * @param query - User's original search query
	 * @returns Array of filtered product external IDs, or empty array if no filtering applied
	 */
	filterProducts(products: SearchResult[], query: string): Promise<string[]>;
}
