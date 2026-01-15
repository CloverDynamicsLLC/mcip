import { PriceSortingTestCase } from "../types";

export const priceSortingTestCases: PriceSortingTestCase[] = [
	// --- GROUP 1: IMPLICIT INTENT (Should Sort, No Price) ---
	{
		scenario: "Implicit 'Cheap' -> Sort ASC, Price Null",
		query: "Show me cheap laptops",
		expectedPrice: null,
		expectedSorting: { field: "price", order: "asc" },
	},
	{
		scenario: "Implicit 'Budget' -> Sort ASC, Price Null",
		query: "I need a budget friendly phone",
		expectedPrice: null,
		expectedSorting: { field: "price", order: "asc" },
	},
	{
		scenario: "Implicit 'Expensive' -> Sort DESC, Price Null",
		query: "Show me the most expensive luxury watches",
		expectedPrice: null,
		expectedSorting: { field: "price", order: "desc" },
	},

	// --- GROUP 2: EXPLICIT PRICE (No Sorting, Price Found) ---
	{
		scenario: "Explicit Limit -> Price Found, Sort Null",
		query: "Laptops under $1000",
		expectedPrice: { amount: 1000, operator: "lt" },
		expectedSorting: null,
	},
	{
		scenario: "Explicit Range -> Price Found, Sort Null",
		query: "Phone between 500 and 800 dollars",
		expectedPrice: { amount: 500, maxAmount: 800, operator: "range" },
		expectedSorting: null,
	},
	{
		scenario: "Explicit Exact -> Price Found, Sort Null",
		query: "I have exactly 200 dollars",
		expectedPrice: { amount: 200, operator: "eq" },
		expectedSorting: null,
	},

	// --- GROUP 3: NEUTRAL & MIXED ---
	{
		scenario: "Neutral Query -> Both Null (No Hallucination)",
		query: "Show me Samsung phones",
		expectedPrice: null,
		expectedSorting: null,
	},
	{
		scenario: "Mixed: Cheap + Limit -> Both Set",
		query: "Cheap laptop under 500",
		expectedPrice: { amount: 500, operator: "lt" },
		expectedSorting: { field: "price", order: "asc" },
	},
	{
		scenario: "Explicit Sort Request -> Sort Set",
		query: "List all items sorted by price descending",
		expectedPrice: null,
		expectedSorting: { field: "price", order: "desc" },
	},
];
