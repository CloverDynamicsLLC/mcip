import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { SearchCriteria } from "../schemas/search.schema";

export interface ExtractionContext {
	validCategories?: string[];
	validBrands?: string[];
}

export const AgentState = Annotation.Root({
	messages: Annotation<BaseMessage[]>({
		reducer: (x, y) => x.concat(y),
	}),
	// Stores the allowed values (from DB)
	context: Annotation<ExtractionContext>({
		reducer: (x, y) => ({ ...x, ...y }),
		default: () => ({}),
	}),
	// Merges the results
	extraction: Annotation<Partial<SearchCriteria>>({
		reducer: (current, update) => ({ ...current, ...update }),
		default: () => ({}),
	}),
});
