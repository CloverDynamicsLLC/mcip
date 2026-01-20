import { Injectable, Logger } from "@nestjs/common";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AgentState } from "../agent/agent.state";
import { CategorySchema } from "../schemas/search.schema";
import { BaseNode } from "./base.node";

/**
 * Node responsible for extracting product category from user query
 */
@Injectable()
export class ExtractCategoryNode extends BaseNode {
	protected readonly logger = new Logger(ExtractCategoryNode.name);

	constructor(private readonly model: BaseChatModel) {
		super();
	}

	/**
	 * Extract category from user query, validating against available categories
	 */
	async execute(state: typeof AgentState.State) {
		const userQuery = this.getUserQuery(state);
		const validList = state.availableAttributes.categories ?? [];
		const validListString = validList.length > 0 ? validList.join(", ") : "No categories available";

		const systemMsg = `You are a category extractor.
The user query is: "${userQuery}"

RULES:
1. Extract the product category from the query.
2. STRICT MATCHING: The result MUST be one of the following: [${validListString}].
3. If the user mentions a category not in this list, return null.
4. Map synonyms intelligently (e.g., "laptop" → "Laptops", "phone" → "Smartphones").
`;

		const structuredModel = this.model.withStructuredOutput(CategorySchema);
		const result = await structuredModel.invoke(systemMsg);

		const normalizedCategory = result.category === "" ? null : result.category;

		this.logger.debug(`Extracted category: ${normalizedCategory}`);

		return {
			extraction: { category: normalizedCategory },
		};
	}
}
