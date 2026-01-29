import { AttributeFilter, SearchFilters } from "../../repository/interfaces/product.repository.interface";
import { SearchCriteria } from "../schemas/search.schema";

/**
 * Utility for building SearchFilters from extracted criteria.
 * Centralizes filter construction logic to avoid duplication.
 */
export class FilterBuilder {
	/**
	 * Build SearchFilters from extracted search criteria
	 */
	static fromCriteria(criteria: Partial<SearchCriteria>, attributeFilters: AttributeFilter[] = []): SearchFilters {
		const filters: SearchFilters = {};

		// Category filters
		if (criteria.categories?.length) {
			filters.category = criteria.categories;
		}
		if (criteria.excludeCategories?.length) {
			filters.excludeCategory = criteria.excludeCategories;
		}

		// Brand filters
		if (criteria.brands?.length) {
			filters.brand = criteria.brands;
		}
		if (criteria.excludeBrands?.length) {
			filters.excludeBrand = criteria.excludeBrands;
		}

		// Price filters
		if (criteria.price) {
			const priceFilters = FilterBuilder.buildPriceFilters(criteria.price);
			Object.assign(filters, priceFilters);
		}

		// Attribute filters
		if (attributeFilters.length > 0) {
			filters.attributes = attributeFilters;
		}

		return filters;
	}

	/**
	 * Build price filter conditions from price criteria
	 */
	private static buildPriceFilters(price: {
		amount: number;
		operator: string;
		maxAmount: number | null;
	}): Pick<SearchFilters, "priceMin" | "priceMax"> {
		const filters: Pick<SearchFilters, "priceMin" | "priceMax"> = {};

		switch (price.operator) {
			case "lt":
				filters.priceMax = price.amount;
				break;
			case "gt":
				filters.priceMin = price.amount;
				break;
			case "eq":
				filters.priceMin = price.amount;
				filters.priceMax = price.amount;
				break;
			case "range":
				filters.priceMin = price.amount;
				if (price.maxAmount !== null) {
					filters.priceMax = price.maxAmount;
				}
				break;
		}

		return filters;
	}

	/**
	 * Check if any filters are present
	 */
	static hasFilters(filters: SearchFilters): boolean {
		return !!(
			filters.brand?.length ||
			filters.excludeBrand?.length ||
			filters.category?.length ||
			filters.excludeCategory?.length ||
			filters.priceMin !== undefined ||
			filters.priceMax !== undefined ||
			filters.attributes?.length
		);
	}
}
