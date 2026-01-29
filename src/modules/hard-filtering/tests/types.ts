import { BrandValidationStatus } from "../schemas/extraction.schema";

export type PriceSortingTestCase = {
	scenario: string;
	query: string;
	expectedPrice: any;
	expectedSorting: any;
};

export type CategoryBrandTestCase = {
	query: string;
	checkType: "category" | "brand";
	allowedValues: string[];
	expectedValue: string | null;
};

/**
 * Test case for brand validation scenarios
 */
export type BrandValidationTestCase = {
	scenario: string;
	query: string;
	availableBrands: string[];
	expectedStatus: BrandValidationStatus;
	expectedBrands: string[];
	shouldHaveResults: boolean;
};
