import { SearchResult } from "../../repository/interfaces/product.repository.interface";
import { FilteringStatus } from "../dto/search-response.dto";

export interface SearchServiceResult {
	results: SearchResult[];
	filteringStatus: FilteringStatus;
	appliedFilters?: {
		brand?: string[];
		excludedBrand?: string[];
		priceRange?: { min?: number; max?: number; currency?: string };
		attributes?: Record<string, string>;
		excludedAttributes?: Record<string, string>;
	};
}
