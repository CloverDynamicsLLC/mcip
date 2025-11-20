import { UnifiedProduct } from "../../../domain/product.schema";

export interface ProductMapper {
	map(raw: any): Promise<UnifiedProduct>;
}
