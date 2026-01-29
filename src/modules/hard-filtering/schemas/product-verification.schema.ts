import { z } from "zod";

/**
 * Schema for LLM product verification response
 */
export const ProductVerificationSchema = z.object({
	validProductIds: z
		.array(z.string())
		.describe("Array of product IDs that match the user query. Return empty array if none match."),
	reasoning: z.string().describe("Brief explanation of why these products were selected or rejected"),
});

export type ProductVerificationResult = z.infer<typeof ProductVerificationSchema>;
