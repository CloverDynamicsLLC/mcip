import { z } from "zod";

export const SortingSchema = z.object({
	field: z.enum(["price"]).describe("Field to sort by"),
	order: z.enum(["asc", "desc"]).describe("Order: asc (low-to-high) or desc (high-to-low)"),
});

export const PriceOperatorSchema = z.enum(["eq", "lt", "gt", "range"]);

/**
 * Schema for category extraction with inclusion and exclusion support
 */
export const CategorySchema = z.object({
	categories: z.array(z.string()).describe("Categories to INCLUDE in search results. MUST be from available list."),
	excludeCategories: z
		.array(z.string())
		.describe("Categories to EXCLUDE from search results. MUST be from available list."),
});

/**
 * Schema for brand extraction with inclusion and exclusion support
 */
export const BrandSchema = z.object({
	brands: z.array(z.string()).describe("Brands to INCLUDE in search results. MUST be from available list."),
	excludeBrands: z.array(z.string()).describe("Brands to EXCLUDE from search results. MUST be from available list."),
});

export const PriceAndSortingSchema = z.object({
	price: z
		.object({
			amount: z.number(),
			operator: PriceOperatorSchema,
			maxAmount: z.number().nullable(),
		})
		.nullable(),
	sorting: SortingSchema.nullable(),
});

/**
 * Complete search criteria extracted from user query
 */
export const SearchCriteriaSchema = z.object({
	categories: z.array(z.string()).default([]).describe("Categories to include, e.g., ['Laptops', 'Tablets']"),
	excludeCategories: z.array(z.string()).default([]).describe("Categories to exclude"),
	brands: z.array(z.string()).default([]).describe("Brands to include, e.g., ['Apple', 'Samsung']"),
	excludeBrands: z.array(z.string()).default([]).describe("Brands to exclude, e.g., ['Huawei']"),
	price: z
		.object({
			amount: z.number().describe("The primary price value"),
			operator: PriceOperatorSchema.describe("Comparison operator: lt (less than), gt (greater than), etc."),
			maxAmount: z.number().nullable().describe("Upper limit if operator is 'range', otherwise null"),
		})
		.nullable(),
	sorting: SortingSchema.nullable().describe("Sort order if user asks for 'cheap', 'expensive', or explicit sorting"),
});

export type SearchCriteria = z.infer<typeof SearchCriteriaSchema>;
export type CategoryExtraction = z.infer<typeof CategorySchema>;
export type BrandExtraction = z.infer<typeof BrandSchema>;