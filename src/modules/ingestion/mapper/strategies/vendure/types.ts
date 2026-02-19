interface VendureAsset {
	id?: string;
	name: string;
	type?: string;
	mimeType?: string;
	source: string;
	preview?: string;
}

interface VendureFacetValue {
	facet: {
		name: string;
	};
	name: string;
}

interface VendureCollection {
	id?: string;
	name: string;
	slug?: string;
}

interface VendureCustomFields {
	rating?: number | null;
	tags?: string | null;
	discountType?: string | null;
	discountValue?: number | null;
}

interface VendureVariant {
	id: string;
	productId?: string;
	sku: string;
	name: string;
	price: number;
	currencyCode?: string;
	priceWithTax: number;
	priceWithTaxInLocalCurrency?: number;
	stockLevel?: string | number;
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
	enabled?: boolean;
	assets: VendureAsset[];
	variants: VendureVariant[];
	facetValues?: VendureFacetValue[];
	collections: VendureCollection[];
	featuredAsset?: VendureAsset & { id?: string };
	customFields?: VendureCustomFields;
}
