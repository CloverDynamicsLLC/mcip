import { UnifiedProduct } from "../../../core/domain/product.schema";

export interface ProductMapper {
	map(raw: any): Promise<UnifiedProduct>;
}
