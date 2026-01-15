import { Test, TestingModule } from "@nestjs/testing";
import { HardFilteringService } from "./hard-filtering.service";
import { ConfigModule } from "@nestjs/config";
import { HardFilteringModule } from "./hard-filtering.module";

interface TestCase {
	query: string;
	checkType: "category" | "brand";
	allowedValues: string[]; // The "Database" simulation
	expectedValue: string | null;
}

const TEST_CASES: TestCase[] = [
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

describe("HardFilteringService", () => {
	let service: HardFilteringService;

	beforeAll(async () => {
		const module: TestingModule = await Test.createTestingModule({
			imports: [await ConfigModule.forRoot(), HardFilteringModule],
		}).compile();
		service = module.get<HardFilteringService>(HardFilteringService);
	}, 20000);

	test.each(TEST_CASES)(
		"Query: '$query' | Allowed: $allowedValues -> Expect: $expectedValue",
		async ({ query, checkType, allowedValues, expectedValue }) => {
			// 1. Prepare Context based on what we are testing
			const context = {
				validCategories: checkType === "category" ? allowedValues : [],
				validBrands: checkType === "brand" ? allowedValues : [],
			};

			// 2. Act
			const result = await service.entrypoint(query, context);

			console.log(`[${checkType}] Allowed: [${allowedValues}] -> Result:`, result);

			// 3. Assert
			if (checkType === "brand") {
				expect(result.brand).toBe(expectedValue);
			} else if (checkType === "category") {
				expect(result.category).toBe(expectedValue);
			}
		},
		30000
	);
});
