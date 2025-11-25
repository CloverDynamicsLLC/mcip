import { UnifiedProduct } from "../../../domain/product.schema";

export class SearchResponseDto {
	meta: {
		count: number;
		take: number;
		skip: number;
		q?: string;
	};
	items: (UnifiedProduct & { score: number })[];
}


