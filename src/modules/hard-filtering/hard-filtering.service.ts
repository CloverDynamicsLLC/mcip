import { Inject, Injectable } from "@nestjs/common";
import { HumanMessage } from "@langchain/core/messages";
import { SearchCriteria, SearchCriteriaSchema } from "./schemas/search.schema";
import { END, START, StateGraph } from "@langchain/langgraph";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AgentLogger } from "./agent/agent.logger";
import { AgentState } from "./agent/agent.state";

@Injectable()
export class HardFilteringService {
	private agentLogger = new AgentLogger();
	private graphRunnable: any;

	constructor(@Inject("CHAT_MODEL") private model: BaseChatModel) {
		this.initGraph();
	}

	private initGraph() {
		const workflow = new StateGraph(AgentState)
			.addNode("baseAttributesExtractor", this.extractBaseAttributesNode)

			.addEdge(START, "baseAttributesExtractor")
			.addEdge("baseAttributesExtractor", END);

		this.graphRunnable = workflow.compile();
	}

	async entrypoint(query: string): Promise<SearchCriteria> {
		const input = {
			messages: [new HumanMessage(query)],
		};

		const config = {
			callbacks: [this.agentLogger],
		};

		const result = await this.graphRunnable.invoke(input, config);

		return result.extraction;
	}

	private extractBaseAttributesNode = async (state: typeof AgentState.State) => {
		const structuredModel = this.model.withStructuredOutput(SearchCriteriaSchema);

		const lastMessage = state.messages[state.messages.length - 1];
		const result = await structuredModel.invoke(lastMessage.content as string);

		return { extraction: result };
	};
}
