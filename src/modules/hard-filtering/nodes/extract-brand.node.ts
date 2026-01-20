import { Injectable, Logger } from "@nestjs/common";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AgentState } from "../agent/agent.state";
import { BrandSchema } from "../schemas/search.schema";
import { BaseNode } from "./base.node";

/**
 * Node responsible for extracting brand from a user query
 */
@Injectable()
export class ExtractBrandNode extends BaseNode {
	protected readonly logger = new Logger(ExtractBrandNode.name);

	constructor(private readonly model: BaseChatModel) {
		super();
	}

	/**
	 * Extract brand from user query, validating against available brands
	 */
	async execute(state: typeof AgentState.State) {
		const userQuery = this.getUserQuery(state);
		const validList = state.availableAttributes.brands ?? [];
		const validListString = validList.length > 0 ? validList.join(", ") : "No brands available";

		const systemMsg = `You are a brand extractor.
The user query is: "${userQuery}"

RULES:
1. Extract the brand name from the query.
2. STRICT MATCHING: The result MUST be one of the following: [${validListString}].
3. If the brand is not in this list, return null.
4. Map product names to brands (e.g., "MacBook" → "Apple", "Galaxy" → "Samsung").
`;

		const structuredModel = this.model.withStructuredOutput(BrandSchema);
		const result = await structuredModel.invoke(systemMsg);

		const normalizedBrand = result.brand === "" || result.brand === "null" ? null : result.brand;

		this.logger.debug(`Extracted brand: ${normalizedBrand}`);

		return {
			extraction: { brand: normalizedBrand },
		};
	}
}
