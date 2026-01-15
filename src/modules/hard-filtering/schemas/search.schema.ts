import { z } from "zod";

export const PriceOperatorSchema = z.enum(["eq", "lt", "gt", "range"]);

export const CategorySchema = z.object({
	category: z.string().nullable().describe("The product category only"),
});

export const BrandSchema = z.object({
	brand: z.string().nullable().describe("The brand name only"),
});

export const PriceSchema = z.object({
	price: z
		.object({
			amount: z.number(),
			operator: PriceOperatorSchema,
			maxAmount: z.number().nullable(),
		})
		.nullable(),
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
});

export type SearchCriteria = z.infer<typeof SearchCriteriaSchema>;
