import { UnifiedProduct } from "../../../domain/product.schema";

export class SearchResponseDto {
	meta: {
		count: number;
		take: number;
		skip: number;
		q: string;
	
		// What strategy was used to filter the products
		filteringStatus?: "AI_FILTERED" | "AI_RANKED" | "RAG_ONLY";
		
		// Details about what filters were applied (optional, for transparency)
		appliedFilters?: {
			brand?: string[];
			priceRange?: { min?: number; max?: number; currency?: string };
			attributes?: Record<string, string>;
			sortBy?: string;
		};
	};
	items: (UnifiedProduct & { score: number })[];
}

