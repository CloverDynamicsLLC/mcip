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
import { AgenticSearchInput, AppliedFilters } from "./interfaces/agentic-search-result.interface";
import { AgenticSearchResponseDto } from "./dto/agentic-search.dto";

// Nodes
import {
	ExtractCategoryNode,
	ExtractIntendedBrandNode,
	ExtractPriceNode,
	InitialSearchNode,
	ValidateBrandsNode,
	LlmVerificationNode,
} from "./nodes";

/**
 * Service orchestrating the agentic search workflow using LangGraph.
 *
 * Flow:
 * 1. Extract basic filters (category, intended brand, price) in parallel
 * 2. Validate intended brands against available store brands
 * 3. Perform search with basic filters (or end if brand not found)
 * 4. Verify results using LLM to filter by semantic relevance
 */
@Injectable()
export class HardFilteringService {
	private readonly logger = new ConsoleLogger(HardFilteringService.name);
	private readonly agentLogger = new AgentLogger();

	// Graph instance
	private agenticGraphRunnable: any;

	// Nodes
	private readonly extractCategoryNode: ExtractCategoryNode;
	private readonly extractIntendedBrandNode: ExtractIntendedBrandNode;
	private readonly validateBrandsNode: ValidateBrandsNode;
	private readonly extractPriceNode: ExtractPriceNode;
	private readonly initialSearchNode: InitialSearchNode;
	private readonly llmVerificationNode: LlmVerificationNode;

	constructor(
		@Inject(LLM_MODEL) private readonly model: BaseChatModel,
		@Inject(PRODUCT_REPOSITORY) private readonly productRepository: ProductRepository,
		@Inject(VECTORIZATION_SERVICE) private readonly vectorizationService: VectorizationService
	) {
		// Initialize nodes with dependencies
		this.extractCategoryNode = new ExtractCategoryNode(this.model);
		this.extractIntendedBrandNode = new ExtractIntendedBrandNode(this.model);
		this.validateBrandsNode = new ValidateBrandsNode();
		this.extractPriceNode = new ExtractPriceNode(this.model);
		this.initialSearchNode = new InitialSearchNode(this.productRepository, this.vectorizationService);
		this.llmVerificationNode = new LlmVerificationNode(this.model);

		// Initialize graph
		this.initAgenticGraph();
	}

	/** Maximum number of products to return in response */
	private readonly MAX_RESULTS = 5;

	/**
	 * Full agentic search workflow with attribute extraction and mapping.
	 */
	async agenticSearch(input: AgenticSearchInput): Promise<AgenticSearchResponseDto> {
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

		return this.buildResponseDto(result, input.query);
	}

	/**
	 * Initialize the agentic search graph
	 */
	private initAgenticGraph() {
		const workflow = new StateGraph(AgentState)
			// Stage 1: Parallel filter extraction
			.addNode("extractCategory", (state) => this.extractCategoryNode.execute(state))
			.addNode("extractIntendedBrand", (state) => this.extractIntendedBrandNode.execute(state))
			.addNode("extractPrice", (state) => this.extractPriceNode.execute(state))

			// Stage 2: Validate brands against available store brands
			.addNode("validateBrands", (state) => this.validateBrandsNode.execute(state))

			// Stage 3: Search with basic filters
			.addNode("search", (state) => this.initialSearchNode.execute(state))

			// Stage 4: LLM verification of results
			.addNode("llmVerification", (state) => this.llmVerificationNode.execute(state))

			// Edges: Stage 1 (parallel extraction)
			.addEdge(START, "extractCategory")
			.addEdge(START, "extractIntendedBrand")
			.addEdge(START, "extractPrice")

			// Edges: Stage 1 → Stage 2 (all extraction nodes converge to validateBrands)
			.addEdge("extractCategory", "validateBrands")
			.addEdge("extractIntendedBrand", "validateBrands")
			.addEdge("extractPrice", "validateBrands")

			// Edges: Stage 2 → Stage 3 (conditional: end if brand not found)
			.addConditionalEdges(
				"validateBrands",
				(state) => {
					if (state.brandValidationStatus === "not_found") {
						this.logger.log("User requested brand(s) not in store, returning zero results");
						return "end";
					}
					return "continue";
				},
				{
					continue: "search",
					end: END,
				}
			)

			// Edges: Stage 3 → Stage 4 (conditional: skip if no products)
			.addConditionalEdges(
				"search",
				(state) => {
					if (state.finalResults.length === 0) {
						this.logger.log("No products found, ending workflow early");
						return "end";
					}
					return "continue";
				},
				{
					continue: "llmVerification",
					end: END,
				}
			)

			// Edges: Stage 4 → END
			.addEdge("llmVerification", END);

		this.agenticGraphRunnable = workflow.compile();
	}

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
			provided?.categories ?? this.productRepository.getFacetValues("category"),
			provided?.brands ?? this.productRepository.getFacetValues("brand"),
		]);

		return { categories, brands };
	}

	/**
	 * Build the response DTO from the graph state
	 */
	private buildResponseDto(state: typeof AgentState.State, query: string): AgenticSearchResponseDto {
		const topProducts = state.finalResults.slice(0, this.MAX_RESULTS);

		return {
			meta: {
				total: topProducts.length,
				query,
			},
			items: topProducts.map((p) => ({
				score: p.score,
				product: p.product,
			})),
			appliedFilters: this.buildAppliedFilters(state),
		};
	}

	/**
	 * Build applied filters from the graph state
	 */
	private buildAppliedFilters(state: typeof AgentState.State): AppliedFilters {
		const { extraction, attributeFilters, brandValidationStatus } = state;

		const appliedFilters: AppliedFilters = {
			brandValidationStatus,
		};

		// Add brand filters if present
		if (extraction.brands?.length) {
			appliedFilters.brands = extraction.brands;
		}
		if (extraction.excludeBrands?.length) {
			appliedFilters.excludeBrands = extraction.excludeBrands;
		}

		// Add category filters if present
		if (extraction.categories?.length) {
			appliedFilters.categories = extraction.categories;
		}
		if (extraction.excludeCategories?.length) {
			appliedFilters.excludeCategories = extraction.excludeCategories;
		}

		// Add price filter if present
		if (extraction.price) {
			appliedFilters.price = {
				amount: extraction.price.amount,
				operator: extraction.price.operator,
				maxAmount: extraction.price.maxAmount,
			};
		}

		// Add sorting if present
		if (extraction.sorting) {
			appliedFilters.sorting = {
				field: extraction.sorting.field,
				order: extraction.sorting.order,
			};
		}

		// Add attribute filters if present
		if (attributeFilters?.length) {
			appliedFilters.attributes = attributeFilters;
		}

		return appliedFilters;
	}
}
