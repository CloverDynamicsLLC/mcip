import { Injectable, Logger } from "@nestjs/common";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AgentState } from "../agent/agent.state";
import { CategorySchema } from "../schemas/search.schema";
import { BaseNode } from "./base.node";

/**
 * Node responsible for extracting categories (include and exclude) from a user query
 */
@Injectable()
export class ExtractCategoryNode extends BaseNode {
	protected readonly logger = new Logger(ExtractCategoryNode.name);

	constructor(private readonly model: BaseChatModel) {
		super();
	}

	/**
	 * Extract categories to include and exclude from user query
	 */
	async execute(state: typeof AgentState.State) {
		const userQuery = this.getUserQuery(state);
		const validList = state.availableAttributes.categories ?? [];
		const validListString = validList.length > 0 ? validList.join(", ") : "No categories available";

		const systemMsg = `You are a category extractor for an e-commerce search system.
User Query: "${userQuery}"

Available Categories: [${validListString}]

TASK: Extract categories the user wants to INCLUDE and EXCLUDE from search results.

RULES:
1. INCLUSION patterns - user WANTS these categories:
   - Direct mention: "laptop", "smartphone", "headphones"
   - Synonyms: "phone" → Smartphones, "notebook" → Laptops, "earbuds" → Headphones

2. EXCLUSION patterns - user does NOT want these categories:
   - "but not [category]"
   - "except [category]"
   - "without [category]"
   - "no [category]"
   - "not [category]"
   - "everything but [category]"

3. STRICT MATCHING: All extracted categories MUST be from the available list: [${validListString}]
4. Map user terms to EXACT category names from the list intelligently.
5. A category cannot be in both include and exclude lists.
6. If no categories are mentioned or match, return empty arrays.

EXAMPLES:
- "gaming laptop" → categories: ["Laptops"], excludeCategories: []
- "electronics but not phones" → categories: [], excludeCategories: ["Smartphones"]
- "laptop or tablet" → categories: ["Laptops", "Tablets"], excludeCategories: []
- "headphones except wireless" → categories: ["Headphones"], excludeCategories: []
`;

		this.logger.debug(
			`Available categories before LLM extraction (${validList.length} total): [${validListString}]`
		);

		const structuredModel = this.model.withStructuredOutput(CategorySchema);
		const result = await structuredModel.invoke(systemMsg);

		// Validate against available categories
		const validCategories = this.validateCategories(result.categories, validList);
		const validExcludeCategories = this.validateCategories(result.excludeCategories, validList);

		// Ensure no overlap
		const excludeSet = new Set(validExcludeCategories);
		const finalCategories = validCategories.filter((c) => !excludeSet.has(c));

		this.logger.debug(
			`Extracted categories: [${finalCategories.join(", ")}], excluded: [${validExcludeCategories.join(", ")}]`
		);

		return {
			extraction: {
				categories: finalCategories,
				excludeCategories: validExcludeCategories,
			},
		};
	}

	/**
	 * Validate extracted categories against available list
	 */
	private validateCategories(extracted: string[], available: string[]): string[] {
		if (!extracted?.length) return [];

		const availableSet = new Set(available.map((c) => c.toLowerCase()));
		const availableMap = new Map(available.map((c) => [c.toLowerCase(), c]));

		return extracted
			.filter((category) => availableSet.has(category.toLowerCase()))
			.map((category) => availableMap.get(category.toLowerCase()) ?? category);
	}
}
