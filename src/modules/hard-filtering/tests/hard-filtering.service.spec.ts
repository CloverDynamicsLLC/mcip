import { Test, TestingModule } from "@nestjs/testing";
import { HardFilteringService } from "../hard-filtering.service";
import { ConfigModule } from "@nestjs/config";
import { HardFilteringModule } from "../hard-filtering.module";
import { categoryBrandTestCases } from "./test-cases/hard-filtering.data";
import { priceSortingTestCases } from "./test-cases/price-sorting.data";
import { brandValidationTestCases } from "./test-cases/brand-validation.data";

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
			const availableAttributes = {
				categories: checkType === "category" ? allowedValues : [],
				brands: checkType === "brand" ? allowedValues : [],
			};

			// 2. Act
			const result = await service.agenticSearch({ query, availableAttributes });

			console.log(`[${checkType}] Allowed: [${allowedValues}] -> Result:`, result.appliedFilters);

			// 3. Assert
			if (checkType === "brand") {
				if (expectedValue === null) {
					// With new brand validation, if user wanted a brand that doesn't exist,
					// brandValidationStatus should be "not_found" and no brands should be applied
					expect(result.appliedFilters.brandValidationStatus).toBe("not_found");
					expect(result.appliedFilters.brands).toBeUndefined();
				} else {
					expect(result.appliedFilters.brands).toContain(expectedValue);
				}
			} else if (checkType === "category") {
				if (expectedValue === null) {
					expect(result.appliedFilters.categories).toBeUndefined();
				} else {
					expect(result.appliedFilters.categories).toContain(expectedValue);
				}
			}
		},
		30000
	);
});

describe("HardFilteringService - Brand Validation", () => {
	let service: HardFilteringService;

	beforeAll(async () => {
		const module: TestingModule = await Test.createTestingModule({
			imports: [await ConfigModule.forRoot(), HardFilteringModule],
		}).compile();
		service = module.get<HardFilteringService>(HardFilteringService);
	}, 20000);

	test.each(brandValidationTestCases)(
		"$scenario: '$query'",
		async ({ query, availableBrands, expectedStatus, expectedBrands, shouldHaveResults }) => {
			// Act
			const result = await service.agenticSearch({
				query,
				availableAttributes: {
					categories: ["Laptop", "Phone", "TV", "Tablet"],
					brands: availableBrands,
				},
			});

			console.log(
				`Query: "${query}"\n` +
					`Available brands: [${availableBrands}]\n` +
					`Brand validation status: ${result.appliedFilters.brandValidationStatus}\n` +
					`Applied brands: [${result.appliedFilters.brands?.join(", ") ?? "none"}]\n` +
					`Results count: ${result.items.length}`
			);

			// Assert brand validation status
			expect(result.appliedFilters.brandValidationStatus).toBe(expectedStatus);

			// Assert applied brands
			if (expectedBrands.length === 0) {
				expect(result.appliedFilters.brands).toBeUndefined();
			} else {
				expect(result.appliedFilters.brands).toBeDefined();
				expectedBrands.forEach((brand) => {
					expect(result.appliedFilters.brands).toContain(brand);
				});
			}

			// Assert result count based on brand validation
			if (!shouldHaveResults && expectedStatus === "not_found") {
				// If brand not found, should return zero results
				expect(result.items.length).toBe(0);
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
			const result = await service.agenticSearch({ query });

			console.log(
				`Query: "${query}"\nPrice:`,
				result.appliedFilters.price,
				`\nSorting:`,
				result.appliedFilters.sorting
			);

			// Assert Sorting
			if (expectedSorting === null) {
				expect(result.appliedFilters.sorting).toBeUndefined();
			} else {
				expect(result.appliedFilters.sorting).toEqual(expectedSorting);
			}

			// Assert Price
			if (expectedPrice === null) {
				expect(result.appliedFilters.price).toBeUndefined();
			} else {
				expect(result.appliedFilters.price).toMatchObject(expectedPrice);
			}
		},
		30000
	);
});
