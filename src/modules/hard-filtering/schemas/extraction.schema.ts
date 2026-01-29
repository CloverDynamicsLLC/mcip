/**
 * Represents an attribute with its available values
 */
export interface AttributeMap {
	key: string;
	values: string[];
}

/**
 * Context for available attributes during filter extraction
 */
export interface AvailableAttributesContext {
	categories?: string[];
	brands?: string[];
	map?: AttributeMap[];
}

/**
 * Status of the agentic search process
 */
export type SearchStatus = "success" | "no_results" | "partial";

/**
 * Status of brand validation against available store brands
 * - no_brand_specified: User didn't ask for any specific brand
 * - matched: All intended brands exist in store
 * - partial: Some intended brands exist (at least one matched)
 * - not_found: User wanted specific brands but NONE exist in store
 */
export type BrandValidationStatus = "no_brand_specified" | "matched" | "partial" | "not_found";

/**
 * User's intended brands extracted from query (before validation)
 */
export interface IntendedBrands {
	brands: string[];
	excludeBrands: string[];
}

/**
 * Attribute filter to apply during search
 */
export interface AttributeFilterSpec {
	name: string;
	values: string[];
}
