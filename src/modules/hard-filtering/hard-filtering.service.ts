import { ConsoleLogger, Inject, Injectable } from "@nestjs/common";
import { HumanMessage } from "@langchain/core/messages";
import { END, START, StateGraph } from "@langchain/langgraph";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

import { AgentLogger } from "./agent/agent.logger";
import { AgentState } from "./agent/agent.state";
import { LLM_MODEL, PRODUCT_REPOSITORY, VECTORIZATION_SERVICE } from "../../constants/tokens";
import type { ProductRepository } from "../repository/interfaces/product.repository.interface";
import type { VectorizationService } from "../vectorization/services/vectorization.service.interface";
import { AvailableAttributesContext } from "./schemas/extraction.schema";
import { SearchCriteria } from "./schemas/search.schema";
import { AgenticSearchInput, AgenticSearchResult } from "./interfaces/agentic-search-result.interface";

// Nodes
import {
	ExtractBrandNode,
	ExtractCategoryNode,
	ExtractCommonAttributesNode,
	ExtractPriceNode,
	FinalSearchNode,
	InitialSearchNode,
	MapAttributesNode,
} from "./nodes";

/**
 * Service orchestrating the agentic search workflow using LangGraph.
 *
 * Flow:
 * 1. Extract basic filters (category, brand, price) in parallel
 * 2. Perform initial search with basic filters
 * 3. Extract common attributes from intermediate results
 * 4. Map user intent to attribute values via LLM
 * 5. Execute the final search with all filters
 */
@Injectable()
export class HardFilteringService {
	private readonly logger = new ConsoleLogger(HardFilteringService.name);
	private readonly agentLogger = new AgentLogger();

	// Graph instances
	private legacyGraphRunnable: any;
	private agenticGraphRunnable: any;

	// Nodes
	private readonly extractCategoryNode: ExtractCategoryNode;
	private readonly extractBrandNode: ExtractBrandNode;
	private readonly extractPriceNode: ExtractPriceNode;
	private readonly initialSearchNode: InitialSearchNode;
	private readonly extractCommonAttributesNode: ExtractCommonAttributesNode;
	private readonly mapAttributesNode: MapAttributesNode;
	private readonly finalSearchNode: FinalSearchNode;

	constructor(
		@Inject(LLM_MODEL) private model: BaseChatModel,
		@Inject(PRODUCT_REPOSITORY) private readonly productRepository: ProductRepository,
		@Inject(VECTORIZATION_SERVICE) private readonly vectorizationService: VectorizationService
	) {
		// Initialize nodes with dependencies
		this.extractCategoryNode = new ExtractCategoryNode(this.model);
		this.extractBrandNode = new ExtractBrandNode(this.model);
		this.extractPriceNode = new ExtractPriceNode(this.model);
		this.initialSearchNode = new InitialSearchNode(this.productRepository, this.vectorizationService);
		this.extractCommonAttributesNode = new ExtractCommonAttributesNode();
		this.mapAttributesNode = new MapAttributesNode(this.model);
		this.finalSearchNode = new FinalSearchNode(this.productRepository);

		// Initialize graphs
		this.initLegacyGraph();
		this.initAgenticGraph();
	}

	/**
	 * Legacy entrypoint for basic filter extraction only.
	 * Use agenticSearch() for the full workflow.
	 */
	async entrypoint(query: string, availableAttributes: AvailableAttributesContext = {}): Promise<SearchCriteria> {
		const input = {
			messages: [new HumanMessage(query)],
			availableAttributes,
		};

		const config = {
			callbacks: [this.agentLogger],
		};

		const result = await this.legacyGraphRunnable.invoke(input, config);

		return result.extraction;
	}

	/**
	 * Full agentic search workflow with attribute extraction and mapping.
	 */
	async agenticSearch(input: AgenticSearchInput): Promise<AgenticSearchResult> {
		this.logger.log(`Starting agentic search for: "${input.query}"`);

		// Fetch available facets if not provided
		const availableAttributes = await this.getAvailableAttributes(input.availableAttributes);

		const graphInput = {
			messages: [new HumanMessage(input.query)],
			availableAttributes,
		};

		const config = {
			callbacks: [this.agentLogger],
		};

		const result = await this.agenticGraphRunnable.invoke(graphInput, config);

		return this.buildAgenticResult(result);
	}

	/**
	 * Initialize the legacy graph (basic filter extraction only)
	 */
	private initLegacyGraph() {
		const workflow = new StateGraph(AgentState)
			.addNode("extractCategory", (state) => this.extractCategoryNode.execute(state))
			.addNode("extractBrand", (state) => this.extractBrandNode.execute(state))
			.addNode("extractPrice", (state) => this.extractPriceNode.execute(state))
			.addNode("validateAndLog", this.validateAndLogNode)

			.addEdge(START, "extractCategory")
			.addEdge(START, "extractBrand")
			.addEdge(START, "extractPrice")

			.addEdge("extractCategory", "validateAndLog")
			.addEdge("extractBrand", "validateAndLog")
			.addEdge("extractPrice", "validateAndLog")

			.addEdge("validateAndLog", END);

		this.legacyGraphRunnable = workflow.compile();
	}

	/**
	 * Initialize the full agentic search graph
	 */
	private initAgenticGraph() {
		const workflow = new StateGraph(AgentState)
			// Stage 1: Parallel filter extraction
			.addNode("extractCategory", (state) => this.extractCategoryNode.execute(state))
			.addNode("extractBrand", (state) => this.extractBrandNode.execute(state))
			.addNode("extractPrice", (state) => this.extractPriceNode.execute(state))

			// Stage 2: Initial search with basic filters
			.addNode("initialSearch", (state) => this.initialSearchNode.execute(state))

			// Stage 3: Extract common attributes from results
			.addNode("extractCommonAttributes", (state) => this.extractCommonAttributesNode.execute(state))

			// Stage 4: Map user intent to attribute values
			.addNode("mapAttributes", (state) => this.mapAttributesNode.execute(state))

			// Stage 5: Final search with all filters
			.addNode("finalSearch", (state) => this.finalSearchNode.execute(state))

			// Edges: Stage 1 (parallel)
			.addEdge(START, "extractCategory")
			.addEdge(START, "extractBrand")
			.addEdge(START, "extractPrice")

			// Edges: Stage 1 → Stage 2 (all extraction nodes converge to initial search)
			.addEdge("extractCategory", "initialSearch")
			.addEdge("extractBrand", "initialSearch")
			.addEdge("extractPrice", "initialSearch")

			// Edges: Stage 2 → Stage 3 (conditional: skip if no products)
			.addConditionalEdges(
				"initialSearch",
				(state) => {
					if (state.intermediateProducts.length === 0) {
						this.logger.log("No products found, ending workflow early");
						return "end";
					}
					return "continue";
				},
				{
					continue: "extractCommonAttributes",
					end: END,
				}
			)

			// Edges: Stage 3 → Stage 4
			.addEdge("extractCommonAttributes", "mapAttributes")

			// Edges: Stage 4 → Stage 5
			.addEdge("mapAttributes", "finalSearch")

			// Edges: Stage 5 → END
			.addEdge("finalSearch", END);

		this.agenticGraphRunnable = workflow.compile();
	}

	/**
	 * Simple logging node for legacy graph
	 */
	private validateAndLogNode = async (state: typeof AgentState.State) => {
		const lastMessage = state.messages[state.messages.length - 1].content as string;
		const extractedInfo = JSON.stringify(state.extraction, null, 2);
		this.logger.log(`Extraction complete for query: "${lastMessage}"`);
		this.logger.debug(`Extracted filters: ${extractedInfo}`);
		return {};
	};

	/**
	 * Get available attributes for filtering, either from input or by fetching from repository
	 */
	private async getAvailableAttributes(provided?: {
		categories?: string[];
		brands?: string[];
	}): Promise<AvailableAttributesContext> {
		if (provided?.categories && provided?.brands) {
			return {
				categories: provided.categories,
				brands: provided.brands,
			};
		}

		// Fetch from a repository
		const [categories, brands] = await Promise.all([
			provided?.categories ?? await this.productRepository.getFacetValues("category"),
			provided?.brands ?? await this.productRepository.getFacetValues("brand"),
		]);

		return { categories, brands };
	}

	/**
	 * Build the final AgenticSearchResult from the graph state
	 */
	private buildAgenticResult(state: typeof AgentState.State): AgenticSearchResult {
		const {
			extraction,
			finalResults,
			searchStatus,
			discoveredAttributes,
			attributeFilters,
			attributeMappingReasoning,
		} = state;

		return {
			products: finalResults,
			status: searchStatus,
			appliedFilters: {
				brands: extraction.brands?.length ? extraction.brands : undefined,
				excludeBrands: extraction.excludeBrands?.length ? extraction.excludeBrands : undefined,
				categories: extraction.categories?.length ? extraction.categories : undefined,
				excludeCategories: extraction.excludeCategories?.length ? extraction.excludeCategories : undefined,
				price: extraction.price ?? undefined,
				sorting: extraction.sorting ?? undefined,
				attributes: attributeFilters.length > 0 ? attributeFilters : undefined,
			},
			discoveredAttributes: discoveredAttributes.length > 0 ? discoveredAttributes : undefined,
			reasoning: attributeMappingReasoning || undefined,
		};
	}
}
