import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { SearchCriteria } from "../schemas/search.schema";

export const AgentState = Annotation.Root({
	messages: Annotation<BaseMessage[]>({
		reducer: (x, y) => x.concat(y),
	}),
	extraction: Annotation<SearchCriteria | null>({
		reducer: (x, y) => y ?? x,
		default: () => null,
	}),
});
