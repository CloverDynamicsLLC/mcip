import { z } from "zod";

/**
 * Confidence level for attribute mapping
 */
export const ConfidenceLevelSchema = z.enum(["high", "medium", "low"]);

/**
 * Single attribute mapping from user intent to product attribute values
 */
export const SingleAttributeMappingSchema = z.object({
	attributeName: z.string().describe("The exact attribute name from the product catalog"),
	selectedValues: z.array(z.string()).describe("Attribute values that match user intent"),
	confidence: ConfidenceLevelSchema.describe("Confidence level of this mapping"),
});

/**
 * Complete attribute mapping result from LLM
 */
export const AttributeMappingSchema = z.object({
	mappings: z.array(SingleAttributeMappingSchema).describe("List of attribute-to-value mappings"),
	reasoning: z.string().describe("Brief explanation of the mapping logic"),
});

export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;
export type SingleAttributeMapping = z.infer<typeof SingleAttributeMappingSchema>;
export type AttributeMapping = z.infer<typeof AttributeMappingSchema>;
