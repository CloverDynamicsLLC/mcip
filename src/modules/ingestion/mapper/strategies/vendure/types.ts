interface VendureAsset {
	name: string;
	type: string;
	mimeType: string;
	source: string;
	preview: string;
}

interface VendureFacetValue {
	facet: {
		name: string;
	};
	name: string;
}

interface VendureCollection {
	name: string;
	slug: string;
}

interface VendureVariant {
	id: string;
	productId: string;
	sku: string;
	name: string;
	price: number;
	currencyCode: string;
	priceWithTax: number;
	stockLevel: string | number;
	options?: {
		code: string;
		name: string;
	}[];
	assets?: VendureAsset[];
}

export interface VendureProduct {
	id: string;
	name: string;
	slug: string;
	description: string;
	enabled: boolean;
	assets: VendureAsset[];
	variants: VendureVariant[];
	facetValues: VendureFacetValue[];
	collections: VendureCollection[];
	featuredAsset?: VendureAsset;
}
