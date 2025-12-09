import { UnifiedProduct } from "../../../domain/product.schema";

export type ScoredProduct = UnifiedProduct & { score: number };

export enum FilteringStatus {
	AI_FILTERED = "AI_FILTERED",
	AI_RANKED = "AI_RANKED",
	RAG_ONLY = "RAG_ONLY",
}

export class SearchResponseDto {
	meta: {
		count: number;
		take: number;
		skip: number;
		q: string;
		filteringStatus?: FilteringStatus;
		appliedFilters?: {
			brand?: string[];
			priceRange?: { min?: number; max?: number; currency?: string };
			attributes?: Record<string, string>;
			sortBy?: string;
		};
	};
	items: ScoredProduct[];
}

