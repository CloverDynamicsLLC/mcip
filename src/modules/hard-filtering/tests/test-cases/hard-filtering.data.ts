import { CategoryBrandTestCase } from "../types";

export const categoryBrandTestCases: CategoryBrandTestCase[] = [
	// CASE 1: Perfect Match
	{
		query: "I want a MacBook",
		checkType: "brand",
		allowedValues: ["Apple", "Lenovo", "Dell"],
		expectedValue: "Apple", // LLM should map "MacBook" -> "Apple" if it's smart, or at least recognize Apple context
	},
	// CASE 2: No Match (Filter functionality)
	{
		query: "Show me Samsung phones",
		checkType: "brand",
		allowedValues: ["Apple", "Google", "Motorola"], // Samsung is NOT here
		expectedValue: null, // Should return null because Samsung isn't in DB
	},
	// CASE 3: Category Mapping
	{
		query: "I need a gaming rig",
		checkType: "category",
		allowedValues: ["Laptop", "Desktop", "Console"],
		expectedValue: "Desktop", // LLM infers "gaming rig" -> "Desktop" from the allowed list
	},
	// CASE 4: Ambiguity
	{
		query: "cheap laptop",
		checkType: "category",
		allowedValues: ["Smartphone", "Laptop", "Tablet"],
		expectedValue: "Laptop",
	},
];
