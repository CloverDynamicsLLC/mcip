import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";
import { AppliedFilters } from "../interfaces/agentic-search-result.interface";

/**
 * Request DTO for agentic search endpoint
 */
export class AgenticSearchRequestDto {
	@IsString()
	@IsNotEmpty()
	query: string;

	@IsOptional()
	@IsInt()
	@Min(1)
	limit?: number;
}

/**
 * Response DTO for agentic search endpoint
 */
export class AgenticSearchResponseDto {
	meta: {
		total: number;
		query: string;
	};
	items: Array<{
		score: number;
		product: {
			externalId: string;
			url: string;
			title: string;
			description: string;
			brand?: string;
			category?: string;
			price: {
				amount: number;
				currency: string;
			};
			mainImage: string;
			attributes: Array<{
				name: string;
				value: string | number | boolean;
			}>;
		};
	}>;
	/** All filters that were applied during search */
	appliedFilters: AppliedFilters;
}
