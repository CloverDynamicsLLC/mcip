import { Test, TestingModule } from "@nestjs/testing";
import { HardFilteringService } from "../hard-filtering.service";
import { ConfigModule } from "@nestjs/config";
import { HardFilteringModule } from "../hard-filtering.module";
import { categoryBrandTestCases } from "./test-cases/hard-filtering.data";
import { priceSortingTestCases } from "./test-cases/price-sorting.data";

describe("HardFilteringService", () => {
	let service: HardFilteringService;

	beforeAll(async () => {
		const module: TestingModule = await Test.createTestingModule({
			imports: [await ConfigModule.forRoot(), HardFilteringModule],
		}).compile();
		service = module.get<HardFilteringService>(HardFilteringService);
	}, 20000);

	test.each(categoryBrandTestCases)(
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

describe("HardFilteringService - Price & Sorting Logic", () => {
	let service: HardFilteringService;

	beforeAll(async () => {
		const [module] = await Promise.all([
			Test.createTestingModule({
				imports: [await ConfigModule.forRoot(), HardFilteringModule],
			}).compile(),
		]);
		service = module.get<HardFilteringService>(HardFilteringService);
	}, 20000);

	test.each(priceSortingTestCases)(
		"$scenario: '$query'",
		async ({ query, expectedPrice, expectedSorting }) => {
			// Act
			const result = await service.entrypoint(query);

			console.log(`Query: "${query}"\nPrice:`, result.price, `\nSorting:`, result.sorting);

			// Assert Sorting
			if (expectedSorting === null) {
				expect(result.sorting).toBeNull();
			} else {
				expect(result.sorting).toEqual(expectedSorting);
			}

			// Assert Price
			if (expectedPrice === null) {
				expect(result.price).toBeNull();
			} else {
				expect(result.price).toMatchObject(expectedPrice);
			}
		},
		30000
	);
});
