import { Injectable, Logger } from "@nestjs/common";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AgentState } from "../agent/agent.state";
import { IntendedBrandSchema } from "../schemas/search.schema";
import { BaseNode } from "./base.node";

/**
 * Node responsible for extracting user's intended brands from a query
 * WITHOUT restricting to available brands in the store.
 *
 * This is the first step of a two-step brand extraction process:
 * 1. ExtractIntendedBrandNode: Extract what brands user is looking for (this node)
 * 2. ValidateBrandsNode: Validate against available brands in store
 */
@Injectable()
export class ExtractIntendedBrandNode extends BaseNode {
	protected readonly logger = new Logger(ExtractIntendedBrandNode.name);

	constructor(private readonly model: BaseChatModel) {
		super();
	}

	/**
	 * Extract brands user intends to search for (include and exclude)
	 * without validating against available brands
	 */
	async execute(state: typeof AgentState.State) {
		const userQuery = this.getUserQuery(state);

		const systemMsg = `You are a brand extractor for an e-commerce search system.
User Query: "${userQuery}"

TASK: Extract brands the user wants to INCLUDE and EXCLUDE from search results.

RULES:
1. INCLUSION patterns - user WANTS these brands:
   - Direct mention: "Nike shoes", "Apple laptop"
   - Product names that map to brands: "MacBook" → Apple, "Galaxy" → Samsung, "ThinkPad" → Lenovo, "iPhone" → Apple, "Surface" → Microsoft, "PlayStation" → Sony, "Xbox" → Microsoft
   - Model names: "Air Jordan" → Nike, "Yeezy" → Adidas

2. EXCLUSION patterns - user does NOT want these brands:
   - "but not [brand]"
   - "except [brand]"
   - "without [brand]"
   - "no [brand]"
   - "everything except [brand]"
   - "any brand but [brand]"
   - "not [brand]"

3. Extract ALL brands mentioned, even if you're not sure they exist in the store.
4. Use proper brand capitalization (e.g., "Apple" not "apple", "Samsung" not "SAMSUNG").
5. A brand cannot be in both include and exclude lists.
6. If no brands are mentioned, return empty arrays.

EXAMPLES:
- "Nike running shoes" → brands: ["Nike"], excludeBrands: []
- "shoes but not Nike" → brands: [], excludeBrands: ["Nike"]
- "Apple or Samsung phone" → brands: ["Apple", "Samsung"], excludeBrands: []
- "laptop except Dell and HP" → brands: [], excludeBrands: ["Dell", "HP"]
- "MacBook Pro" → brands: ["Apple"], excludeBrands: []
- "Galaxy S24" → brands: ["Samsung"], excludeBrands: []
- "cheap laptop" → brands: [], excludeBrands: [] (no brand specified)
`;

		this.logger.debug(`Extracting intended brands from query: "${userQuery}"`);

		const structuredModel = this.model.withStructuredOutput(IntendedBrandSchema);
		const result = await structuredModel.invoke(systemMsg);

		// Ensure no overlap between include and exclude
		const excludeSet = new Set(result.excludeBrands as string[]);
		const finalBrands = (result.brands as string[]).filter((b) => !excludeSet.has(b));

		this.logger.debug(
			`Extracted intended brands: [${finalBrands.join(", ")}], excluded: [${result.excludeBrands.join(", ")}]`
		);

		return {
			intendedBrands: {
				brands: finalBrands,
				excludeBrands: result.excludeBrands,
			},
		};
	}
}
