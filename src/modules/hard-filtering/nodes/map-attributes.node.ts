import { Injectable, Logger } from "@nestjs/common";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AgentState } from "../agent/agent.state";
import { AttributeMappingSchema } from "../schemas/attribute-mapping.schema";
import { AttributeFilterSpec } from "../schemas/extraction.schema";
import { BaseNode } from "./base.node";

/**
 * Node responsible for mapping user intent to specific attribute values using LLM
 */
@Injectable()
export class MapAttributesNode extends BaseNode {
	protected readonly logger = new Logger(MapAttributesNode.name);

	constructor(private readonly model: BaseChatModel) {
		super();
	}

	/**
	 * Use LLM to map user intent to specific attribute values
	 */
	async execute(state: typeof AgentState.State) {
		const userQuery = this.getUserQuery(state);
		const attributes = state.discoveredAttributes;

		if (attributes.length === 0) {
			this.logger.debug("No discovered attributes, skipping mapping");
			return {
				attributeFilters: [],
				attributeMappingReasoning: "No attributes to map",
			};
		}

		const attributesContext = this.formatAttributesForPrompt(attributes);

		const systemMsg = `You are a product attribute matcher for an e-commerce search system.

User Query: "${userQuery}"

Available product attributes and their possible values:
${attributesContext}

TASK: Identify which attribute values best match what the user is looking for.

RULES:
1. ONLY select values that are EXPLICITLY mentioned or STRONGLY IMPLIED by the user query.
2. Do NOT guess or assume preferences the user didn't express.
3. Map user language to exact attribute values intelligently:
   - "fast" or "performance" → high RAM/CPU/speed values
   - "large screen" → bigger screen size values
   - "lightweight" or "portable" → lower weight values
   - Color names → matching color values
   - Size preferences → matching size values
4. If an attribute has no clear mapping from the user query, do NOT include it.
5. Assign confidence levels:
   - "high": User explicitly mentioned this attribute or a direct synonym
   - "medium": User implied this through related terms
   - "low": Weak or speculative connection (these will be filtered out)
6. Be conservative - it's better to miss a filter than to apply an incorrect one.

IMPORTANT: Only return mappings where you have medium or high confidence.
`;

		try {
			const structuredModel = this.model.withStructuredOutput(AttributeMappingSchema);
			const result = await structuredModel.invoke(systemMsg);

			// Filter to keep only high/medium confidence mappings with non-empty values
			const mappings = result.mappings as Array<{
				attributeName: string;
				selectedValues: string[];
				confidence: string;
			}>;
			const attributeFilters: AttributeFilterSpec[] = mappings
				.filter(
					(m) =>
						m.confidence !== "low" &&
						m.selectedValues.length > 0 &&
						this.isValidMapping(m.attributeName, m.selectedValues, attributes)
				)
				.map((m) => ({
					name: m.attributeName,
					values: m.selectedValues,
				}));

			this.logger.log(`Mapped ${attributeFilters.length} attribute filters`);
			this.logger.debug(`Reasoning: ${result.reasoning}`);

			return {
				attributeFilters,
				attributeMappingReasoning: result.reasoning,
			};
		} catch (error) {
			this.logger.error(`Attribute mapping failed: ${error.message}`);
			return {
				attributeFilters: [],
				attributeMappingReasoning: `Mapping failed: ${error.message}`,
			};
		}
	}

	/**
	 * Format attributes into a human-readable prompt format
	 */
	private formatAttributesForPrompt(attributes: { key: string; values: string[] }[]): string {
		return attributes.map((attr) => `• ${attr.key}: [${attr.values.join(", ")}]`).join("\n");
	}

	/**
	 * Validate that the mapping uses valid attribute names and values
	 */
	private isValidMapping(
		attributeName: string,
		selectedValues: string[],
		availableAttributes: { key: string; values: string[] }[]
	): boolean {
		const attribute = availableAttributes.find((a) => a.key === attributeName);
		if (!attribute) {
			this.logger.warn(`Invalid attribute name: ${attributeName}`);
			return false;
		}

		// Check if all selected values exist in available values
		const invalidValues = selectedValues.filter((v) => !attribute.values.includes(v));

		if (invalidValues.length > 0) {
			this.logger.warn(`Invalid values for ${attributeName}: ${invalidValues.join(", ")}`);
			return false;
		}

		return true;
	}
}
