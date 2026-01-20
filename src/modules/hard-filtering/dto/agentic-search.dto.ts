import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";

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
		count: number;
		query: string;
		status: "success" | "no_results" | "partial";
		appliedFilters: {
			brands?: string[];
			excludeBrands?: string[];
			categories?: string[];
			excludeCategories?: string[];
			price?: {
				amount: number;
				operator: string;
				maxAmount?: number | null;
			};
			sorting?: {
				field: string;
				order: string;
			};
			attributes?: {
				name: string;
				values: string[];
			}[];
		};
		discoveredAttributes?: {
			key: string;
			values: string[];
		}[];
		reasoning?: string;
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
}
