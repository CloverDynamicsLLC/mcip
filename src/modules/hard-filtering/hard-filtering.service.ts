import { Inject, Injectable } from "@nestjs/common";
import { HumanMessage } from "@langchain/core/messages";
import { BrandSchema, CategorySchema, PriceSchema, SearchCriteria } from "./schemas/search.schema";
import { END, START, StateGraph } from "@langchain/langgraph";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AgentLogger } from "./agent/agent.logger";
import { AgentState, ExtractionContext } from "./agent/agent.state";

@Injectable()
export class HardFilteringService {
	private agentLogger = new AgentLogger();
	private graphRunnable: any;

	constructor(@Inject("CHAT_MODEL") private model: BaseChatModel) {
		this.initGraph();
	}

	private initGraph() {
		const workflow = new StateGraph(AgentState)
			.addNode("extractCategory", this.extractCategoryNode)
			.addNode("extractBrand", this.extractBrandNode)
			.addNode("extractPrice", this.extractPriceNode)

			.addEdge(START, "extractCategory")
			.addEdge(START, "extractBrand")
			.addEdge(START, "extractPrice")

			.addEdge("extractCategory", END)
			.addEdge("extractBrand", END)
			.addEdge("extractPrice", END);

		this.graphRunnable = workflow.compile();
	}

	async entrypoint(query: string, context: ExtractionContext = {}): Promise<SearchCriteria> {
		const input = {
			messages: [new HumanMessage(query)],
			context: context,
		};

		const config = {
			callbacks: [this.agentLogger],
		};

		const result = await this.graphRunnable.invoke(input, config);

		return result.extraction;
	}

	private extractCategoryNode = async (state: typeof AgentState.State) => {
		const validList = state.context.validCategories || [];
		const validListString = validList.length > 0 ? validList.join(", ") : "";

		const systemMsg = `You are a category extractor. 
    The user query is: "${state.messages[state.messages.length - 1].content}"
    
    RULES:
    1. Extract the product category from the query.
    2. STRICT MATCHING: The result MUST be one of the following: [${validListString}].
    3. If the user mentions a category not in this list, return null.
    `;

		const model = this.model.withStructuredOutput(CategorySchema);

		const result = await model.invoke(systemMsg);

		const normalizedCategory = result.category === "" ? null : result.category;

		return {
			extraction: { category: normalizedCategory },
		};
	};

	private extractBrandNode = async (state: typeof AgentState.State) => {
		const validList = state.context.validBrands || [];
		const validListString = validList.length > 0 ? validList.join(", ") : "";

		const systemMsg = `You are a brand extractor. 
    The user query is: "${state.messages[state.messages.length - 1].content}"
    
    RULES:
    1. Extract the brand name.
    2. STRICT MATCHING: The result MUST be one of the following: [${validListString}].
    3. If the brand is not in this list, return null.
    `;

		const model = this.model.withStructuredOutput(BrandSchema);
		const result = await model.invoke(systemMsg);
		const normalizedBrand = result.brand === "" || result.brand === "null" ? null : result.brand;

		return {
			extraction: { brand: normalizedBrand },
		};
	};

	private extractPriceNode = async (state: typeof AgentState.State) => {
		const model = this.model.withStructuredOutput(PriceSchema);
		const result = await model.invoke(state.messages[state.messages.length - 1].content as string);

		return { extraction: result };
	};
}
