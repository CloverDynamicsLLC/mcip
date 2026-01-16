import { ConsoleLogger, Inject, Injectable } from "@nestjs/common";
import { HumanMessage } from "@langchain/core/messages";
import { BrandSchema, CategorySchema, PriceAndSortingSchema, SearchCriteria } from "./schemas/search.schema";
import { END, START, StateGraph } from "@langchain/langgraph";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AgentLogger } from "./agent/agent.logger";
import { AgentState } from "./agent/agent.state";
import { LLM_MODEL, PRODUCT_REPOSITORY } from "../../constants/tokens";
import type { ProductRepository } from "../repository/interfaces/product.repository.interface";
import { AvailableAttributesContext } from "./schemas/extraction.schema";

@Injectable()
export class HardFilteringService {
	private readonly logger = new ConsoleLogger("HardFilteringService");
	private agentLogger = new AgentLogger();
	private graphRunnable: any;

	constructor(
		@Inject(LLM_MODEL) private model: BaseChatModel,
		@Inject(PRODUCT_REPOSITORY) private readonly productRepository: ProductRepository
	) {
		this.initGraph();
	}

	private initGraph() {
		const workflow = new StateGraph(AgentState)
			.addNode("extractCategory", this.extractCategoryNode)
			.addNode("extractBrand", this.extractBrandNode)
			.addNode("extractPrice", this.extractPriceNode)
			.addNode("validateAndRetrieveAttributes", this.validateAndRetrieveAttributesNode)

			.addEdge(START, "extractCategory")
			.addEdge(START, "extractBrand")
			.addEdge(START, "extractPrice")

			.addEdge("extractCategory", "validateAndRetrieveAttributes")
			.addEdge("extractBrand", "validateAndRetrieveAttributes")
			.addEdge("extractPrice", "validateAndRetrieveAttributes")

			.addEdge("validateAndRetrieveAttributes", END);

		this.graphRunnable = workflow.compile();
	}

	async entrypoint(query: string, availableAttributes: AvailableAttributesContext = {}): Promise<SearchCriteria> {
		const input = {
			messages: [new HumanMessage(query)],
			availableAttributes: availableAttributes,
		};

		const config = {
			callbacks: [this.agentLogger],
		};

		const result = await this.graphRunnable.invoke(input, config);

		return result.extraction;
	}

	private extractCategoryNode = async (state: typeof AgentState.State) => {
		const validList = state.availableAttributes.categories || [];
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
		const validList = state.availableAttributes.brands || [];
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
		const systemMsg = `You are a Price and Sorting extractor.
    User Query: "${state.messages[state.messages.length - 1].content}"

    RULES:
    1. EXTRACTING PRICE:
       - Only extract specific numbers (e.g., "$500", "under 100").
       - NEVER guess or hallucinate a price range if no numbers are present.
       - If no numbers are found, 'price' MUST be null.

    2. EXTRACTING SORTING:
       - If user says "cheap", "budget", "lowest price" -> set sorting: { field: "price", order: "asc" }.
       - If user says "expensive", "luxury", "premium" -> set sorting: { field: "price", order: "desc" }.
       - If user says "best rated" -> set sorting: { field: "rating", order: "desc" }.
    `;

		const model = this.model.withStructuredOutput(PriceAndSortingSchema);
		const result = await model.invoke(systemMsg);

		return {
			extraction: {
				price: result.price,
				sorting: result.sorting,
			},
		};
	};

	private validateAndRetrieveAttributesNode = async (state: typeof AgentState.State) => {
		const lastMessage = state.messages[state.messages.length - 1].content as string;
		const extractedInfo = JSON.stringify(state.extraction, null, 2);
		this.logger.log(`ALL EXTRACTIONS COMPLETE for query: ${lastMessage} ${extractedInfo}`);

		state.availableAttributes.map = [];

		return {};
	};
}
