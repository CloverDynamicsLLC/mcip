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
