import { ExtractedFilters } from "../interfaces/extracted-filters.interface";

export interface FeatureExtractionService {
	extractFilters(query: string, availableBrands: string[], availableCategories: string[]): Promise<ExtractedFilters>;
}
