export interface ExtractedFilters {
	brand?: string[];
	excludeBrand?: string[];
	category?: string[];
	excludeCategory?: string[];
	priceMin?: number;
	priceMax?: number;
	searchQuery: string;
}
