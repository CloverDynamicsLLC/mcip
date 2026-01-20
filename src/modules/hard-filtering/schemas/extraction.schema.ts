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
 * Attribute filter to apply during search
 */
export interface AttributeFilterSpec {
	name: string;
	values: string[];
}
