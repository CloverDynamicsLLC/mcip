import { Injectable, Logger } from "@nestjs/common";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AgentState } from "../agent/agent.state";
import { BrandSchema } from "../schemas/search.schema";
import { BaseNode } from "./base.node";

/**
 * Node responsible for extracting brands (include and exclude) from a user query
 */
@Injectable()
export class ExtractBrandNode extends BaseNode {
	protected readonly logger = new Logger(ExtractBrandNode.name);

	constructor(private readonly model: BaseChatModel) {
		super();
	}

	/**
	 * Extract brands to include and exclude from user query
	 */
	async execute(state: typeof AgentState.State) {
		const userQuery = this.getUserQuery(state);
		const validList = state.availableAttributes.brands ?? [];
		const validListString = validList.length > 0 ? validList.join(", ") : "No brands available";

		const systemMsg = `You are a brand extractor for an e-commerce search system.
User Query: "${userQuery}"

Available Brands: [${validListString}]

TASK: Extract brands the user wants to INCLUDE and EXCLUDE from search results.

RULES:
1. INCLUSION patterns - user WANTS these brands:
   - Direct mention: "Nike shoes", "Apple laptop"
   - Product names that map to brands: "MacBook" → Apple, "Galaxy" → Samsung, "ThinkPad" → Lenovo

2. EXCLUSION patterns - user does NOT want these brands:
   - "but not [brand]"
   - "except [brand]"
   - "without [brand]"
   - "no [brand]"
   - "everything except [brand]"
   - "any brand but [brand]"
   - "not [brand]"

3. STRICT MATCHING: All extracted brands MUST be from the available list: [${validListString}]
4. If a mentioned brand is not in the list, DO NOT include it.
5. A brand cannot be in both include and exclude lists.
6. If no brands are mentioned or match, return empty arrays.

EXAMPLES:
- "Nike running shoes" → brands: ["Nike"], excludeBrands: []
- "shoes but not Nike" → brands: [], excludeBrands: ["Nike"]
- "Apple or Samsung phone" → brands: ["Apple", "Samsung"], excludeBrands: []
- "laptop except Dell and HP" → brands: [], excludeBrands: ["Dell", "HP"]
- "Nike shoes without Adidas" → brands: ["Nike"], excludeBrands: ["Adidas"]
`;

		const structuredModel = this.model.withStructuredOutput(BrandSchema);
		const result = await structuredModel.invoke(systemMsg);

		// Validate against available brands
		const validBrands = this.validateBrands(result.brands, validList);
		const validExcludeBrands = this.validateBrands(result.excludeBrands, validList);

		// Ensure no overlap
		const excludeSet = new Set(validExcludeBrands);
		const finalBrands = validBrands.filter((b) => !excludeSet.has(b));

		this.logger.debug(`Extracted brands: [${finalBrands.join(", ")}], excluded: [${validExcludeBrands.join(", ")}]`);

		return {
			extraction: {
				brands: finalBrands,
				excludeBrands: validExcludeBrands,
			},
		};
	}

	/**
	 * Validate extracted brands against available list
	 */
	private validateBrands(extracted: string[], available: string[]): string[] {
		if (!extracted?.length) return [];

		const availableSet = new Set(available.map((b) => b.toLowerCase()));
		const availableMap = new Map(available.map((b) => [b.toLowerCase(), b]));

		return extracted
			.filter((brand) => availableSet.has(brand.toLowerCase()))
			.map((brand) => availableMap.get(brand.toLowerCase()) ?? brand);
	}
}
