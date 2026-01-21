import { Injectable, Logger } from "@nestjs/common";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AgentState } from "../agent/agent.state";
import { PriceAndSortingSchema } from "../schemas/search.schema";
import { BaseNode } from "./base.node";

/**
 * Node responsible for extracting price conditions and sorting preferences
 */
@Injectable()
export class ExtractPriceNode extends BaseNode {
	protected readonly logger = new Logger(ExtractPriceNode.name);

	constructor(private readonly model: BaseChatModel) {
		super();
	}

	/**
	 * Extract price range and sorting preferences from a user query
	 */
	async execute(state: typeof AgentState.State) {
		const userQuery = this.getUserQuery(state);

		const systemMsg = `You are a Price and Sorting extractor.
User Query: "${userQuery}"

RULES:
1. EXTRACTING PRICE:
   - Only extract specific numbers (e.g., "$500", "under 100", "between 100 and 500").
   - NEVER guess or hallucinate a price range if no numbers are present.
   - If no numbers are found, 'price' MUST be null.
   - Use operator 'lt' for "under/below/less than", 'gt' for "over/above/more than".
   - Use operator 'range' for "between X and Y" with amount as min and maxAmount as max.
   - Use operator 'eq' for exact price matches.

2. EXTRACTING SORTING:
   - If user says "cheap", "budget", "lowest price", "affordable" → set sorting: { field: "price", order: "asc" }.
   - If user says "expensive", "luxury", "premium", "high-end" → set sorting: { field: "price", order: "desc" }.
   - If no sorting preference is expressed, sorting MUST be null.
`;

		const structuredModel = this.model.withStructuredOutput(PriceAndSortingSchema);
		const result = await structuredModel.invoke(systemMsg);

		this.logger.debug(
			`Extracted price: ${JSON.stringify(result.price)}, sorting: ${JSON.stringify(result.sorting)}`
		);

		return {
			extraction: {
				price: result.price,
				sorting: result.sorting,
			},
		};
	}
}
