import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { SearchCriteria } from "../schemas/search.schema";
import {
	AttributeFilterSpec,
	AttributeMap,
	AvailableAttributesContext,
	SearchStatus,
} from "../schemas/extraction.schema";
import { UnifiedProduct } from "../../../domain/product.schema";
import { SearchResult } from "../../repository/interfaces/product.repository.interface";

/**
 * LangGraph Agent State for a multi-stage agentic search workflow.
 *
 * Flow:
 * 1. Extract basic filters (category, brand, price) in parallel
 * 2. Perform initial search with basic filters
 * 3. Extract common attributes from intermediate results
 * 4. Map user intent to attribute values via LLM
 * 5. Execute the final search with all filters
 */
export const AgentState = Annotation.Root({
	/** Conversation messages */
	messages: Annotation<BaseMessage[]>({
		reducer: (x, y) => x.concat(y),
	}),

	/** Available attribute values for validation */
	availableAttributes: Annotation<AvailableAttributesContext>({
		reducer: (x, y) => ({ ...x, ...y }),
		default: () => ({}),
	}),

	/** Extracted basic filters (category, brand, price, sorting) */
	extraction: Annotation<Partial<SearchCriteria>>({
		reducer: (current, update) => ({ ...current, ...update }),
		default: () => ({}),
	}),

	/** Query vector embedding */
	queryVector: Annotation<number[]>({
		reducer: (_, y) => y,
		default: () => [],
	}),

	/** Products from initial search (for attribute extraction) */
	intermediateProducts: Annotation<UnifiedProduct[]>({
		reducer: (_, y) => y,
		default: () => [],
	}),

	/** Common attributes discovered from intermediate products */
	discoveredAttributes: Annotation<AttributeMap[]>({
		reducer: (_, y) => y,
		default: () => [],
	}),

	/** Refined attribute filters from LLM mapping */
	attributeFilters: Annotation<AttributeFilterSpec[]>({
		reducer: (_, y) => y,
		default: () => [],
	}),

	/** Final search results */
	finalResults: Annotation<SearchResult[]>({
		reducer: (_, y) => y,
		default: () => [],
	}),

	/** Search status indicator */
	searchStatus: Annotation<SearchStatus>({
		reducer: (_, y) => y,
		default: () => "success",
	}),

	/** LLM reasoning for attribute mapping (for debugging/transparency) */
	attributeMappingReasoning: Annotation<string>({
		reducer: (_, y) => y,
		default: () => "",
	}),
});
