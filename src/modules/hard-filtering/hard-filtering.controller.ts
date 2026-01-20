import { BadRequestException, Controller, Get, Logger, Query } from "@nestjs/common";
import { HardFilteringService } from "./hard-filtering.service";
import { AgenticSearchResponseDto } from "./dto/agentic-search.dto";

/**
 * Controller for agentic search endpoints
 */
@Controller()
export class HardFilteringController {
	private readonly logger = new Logger(HardFilteringController.name);

	constructor(private readonly hardFilteringService: HardFilteringService) {}

	/**
	 * Perform agentic search with automatic filter extraction and attribute mapping
	 *
	 * @param query - User search query
	 * @returns Search results with applied filters and metadata
	 */
	@Get("agentic-search")
	async agenticSearch(@Query("query") query: string): Promise<AgenticSearchResponseDto> {
		if (!query || query.trim() === "") {
			throw new BadRequestException("Query parameter is required");
		}

		this.logger.log(`Agentic search request: "${query}"`);

		const result = await this.hardFilteringService.agenticSearch({ query });

		this.logger.log(`Agentic search completed: ${result.products.length} products, status: ${result.status}`);

		return {
			meta: {
				count: result.products.length,
				query,
				status: result.status,
				appliedFilters: result.appliedFilters,
				discoveredAttributes: result.discoveredAttributes,
				reasoning: result.reasoning,
			},
			items: result.products.map((p) => ({
				score: p.score,
				product: {
					externalId: p.product.externalId,
					url: p.product.url,
					title: p.product.title,
					description: p.product.description,
					brand: p.product.brand,
					category: p.product.category,
					price: p.product.price,
					mainImage: p.product.mainImage,
					attributes: p.product.attributes,
				},
			})),
		};
	}
}
