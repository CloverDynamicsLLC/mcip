import { UnifiedProduct } from "../../../domain/product.schema";

export interface VectorizationService {
	/**
	 * Converts a raw string query into a vector embedding.
	 */
	embedString(query: string): Promise<number[]>;

	/**
	 * Generates an embedding for a product by processing its metadata.
	 */
	embedProduct(product: UnifiedProduct): Promise<number[]>;
}
