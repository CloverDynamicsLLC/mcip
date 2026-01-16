import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { SearchCriteria } from "../schemas/search.schema";
import { AvailableAttributesContext } from "../schemas/extraction.schema";

export const AgentState = Annotation.Root({
	messages: Annotation<BaseMessage[]>({
		reducer: (x, y) => x.concat(y),
	}),
	availableAttributes: Annotation<AvailableAttributesContext>({
		reducer: (x, y) => ({ ...x, ...y }),
		default: () => ({}),
	}),
	extraction: Annotation<Partial<SearchCriteria>>({
		reducer: (current, update) => ({ ...current, ...update }),
		default: () => ({}),
	}),
});
