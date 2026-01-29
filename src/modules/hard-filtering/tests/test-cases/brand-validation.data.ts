import { BrandValidationTestCase } from "../types";

/**
 * Test cases for the two-step brand validation process:
 * 1. Extract intended brand from user query (without restriction)
 * 2. Validate against available brands in store
 * 3. Return zero results if user wanted a brand that doesn't exist
 */
export const brandValidationTestCases: BrandValidationTestCase[] = [
	// CASE 1: Brand found in store - should return results
	{
		scenario: "Direct brand mention - brand exists",
		query: "Apple MacBook Pro",
		availableBrands: ["Apple", "Lenovo", "Dell"],
		expectedStatus: "matched",
		expectedBrands: ["Apple"],
		shouldHaveResults: true,
	},

	// CASE 2: Brand NOT found in store - should return zero results
	{
		scenario: "Direct brand mention - brand does NOT exist",
		query: "Samsung Galaxy phone",
		availableBrands: ["Apple", "Google", "Motorola"],
		expectedStatus: "not_found",
		expectedBrands: [],
		shouldHaveResults: false,
	},

	// CASE 3: Product name maps to brand - brand exists
	{
		scenario: "Product name to brand mapping - brand exists",
		query: "I want a MacBook",
		availableBrands: ["Apple", "Lenovo", "Dell"],
		expectedStatus: "matched",
		expectedBrands: ["Apple"],
		shouldHaveResults: true,
	},

	// CASE 4: Product name maps to brand - brand does NOT exist
	{
		scenario: "Product name to brand mapping - brand does NOT exist",
		query: "I want a ThinkPad laptop",
		availableBrands: ["Apple", "Dell", "HP"],
		expectedStatus: "not_found",
		expectedBrands: [],
		shouldHaveResults: false,
	},

	// CASE 5: No brand specified - should return results
	{
		scenario: "No brand specified in query",
		query: "cheap laptop under 500",
		availableBrands: ["Apple", "Lenovo", "Dell"],
		expectedStatus: "no_brand_specified",
		expectedBrands: [],
		shouldHaveResults: true,
	},

	// CASE 6: Multiple brands - some exist (partial match)
	{
		scenario: "Multiple brands - partial match",
		query: "Apple or Samsung laptop",
		availableBrands: ["Apple", "Dell", "HP"],
		expectedStatus: "partial",
		expectedBrands: ["Apple"],
		shouldHaveResults: true,
	},

	// CASE 7: Multiple brands - all exist
	{
		scenario: "Multiple brands - all match",
		query: "Apple or Dell laptop",
		availableBrands: ["Apple", "Dell", "HP"],
		expectedStatus: "matched",
		expectedBrands: ["Apple", "Dell"],
		shouldHaveResults: true,
	},

	// CASE 8: Multiple brands - none exist
	{
		scenario: "Multiple brands - none match",
		query: "Samsung or LG TV",
		availableBrands: ["Sony", "Panasonic", "Sharp"],
		expectedStatus: "not_found",
		expectedBrands: [],
		shouldHaveResults: false,
	},
];
