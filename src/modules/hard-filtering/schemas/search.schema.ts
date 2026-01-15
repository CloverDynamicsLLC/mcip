import { z } from "zod";

export const PriceOperatorSchema = z.enum(["eq", "lt", "gt", "range"]);

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
