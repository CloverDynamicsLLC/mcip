import { z } from "zod";

export const SortingSchema = z.object({
	field: z.enum(["price"]).describe("Field to sort by"),
	order: z.enum(["asc", "desc"]).describe("Order: asc (low-to-high) or desc (high-to-low)"),
});

export const PriceOperatorSchema = z.enum(["eq", "lt", "gt", "range"]);

export const CategorySchema = z.object({
	category: z.string().nullable().describe("The product category only"),
});

export const BrandSchema = z.object({
	brand: z.string().nullable().describe("The brand name only"),
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

export const SearchCriteriaSchema = z.object({
	category: z.string().nullable().describe("The product category, e.g., 'laptop'"),
	brand: z.string().nullable().describe("The brand name, e.g., 'Lenovo'"),
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
