import { Injectable, Logger } from "@nestjs/common";
import {
	CurrencyEnum,
	ProductVariant,
	UnifiedProduct,
	UnifiedProductSchema,
} from "../../../core/domain/product.schema";
import { ProductMapper } from "../product-mapper.interface";

@Injectable()
export class VendureMapper implements ProductMapper {
	private readonly logger = new Logger(VendureMapper.name);

	async map(raw: any): Promise<UnifiedProduct> {
		// 1. Validation
		if (!raw || typeof raw !== "object") {
			throw new Error("Invalid raw product data");
		}

		this.logger.debug(`Mapping Vendure Product: ${raw.name}`);

		// 2. Extract Core Data Helpers
		const priceData = this.extractPrice(raw);
		const brand = this.extractBrand(raw);
		const category = this.extractCategory(raw);
		// Improved: Now merges Facets AND Variant Options
		const attributes = this.extractAttributes(raw);
		const mainImage = this.extractImage(raw);

		// 3. Construct the Unified Object
		const product: UnifiedProduct = {
			externalId: String(raw.id),
			url: raw.slug ? `/product/${raw.slug}` : "",
			title: raw.name || "Untitled Product",
			description: this.stripHtml(raw.description || ""),
			category: category,
			brand: brand,
			price: {
				amount: priceData.amount,
				currency: priceData.currency,
			},
			mainImage: mainImage,
			attributes: attributes,
			variants: this.extractVariants(raw, priceData.amount),
			keywords: this.generateKeywords(raw.name, raw.description, category, brand),
		};

		// 4. Zod Validation
		try {
			return UnifiedProductSchema.parse(product);
		} catch (error) {
			this.logger.error(`Zod Validation Failed for product ${raw.id}`, error);
			throw error;
		}
	}

	// --- Extraction Helpers ---

	private extractPrice(raw: any): { amount: number; currency: "UAH" | "USD" | "EUR" } {
		let rawAmount = 0;
		let rawCurrency = "UAH";

		// Vendure logic: Products have variants. Usually we take the first variant's price as the "From" price.
		if (Array.isArray(raw.variants) && raw.variants.length > 0) {
			const firstVariant = raw.variants[0];
			// Prefer priceWithTax (B2C) -> price (B2B/Net) -> 0
			rawAmount = firstVariant.priceWithTax ?? firstVariant.price ?? 0;
			rawCurrency = firstVariant.currencyCode || "UAH";
		}

		// Normalize Currency
		const currency = this.normalizeCurrency(rawCurrency);

		// Normalize Amount (Vendure stores cents, e.g. 129900 = 1299.00)
		const amount = rawAmount / 100;

		return { amount, currency };
	}

	private extractVariants(raw: any, basePrice: number): ProductVariant[] {
		if (!Array.isArray(raw.variants)) return [];

		return raw.variants.map((v: any) => {
			// Calculate variant price (cents -> float)
			const variantPrice = (v.priceWithTax ?? v.price ?? 0) / 100;

			// Determine if variant is available
			// Handles "IN_STOCK" string or numeric stockLevel
			const isAvailable =
				v.stockLevel === "IN_STOCK" ||
				v.stockLevel === "LOW_STOCK" ||
				(typeof v.stockLevel === "number" && v.stockLevel > 0);

			return {
				sku: v.sku || "UNKNOWN",
				title: v.name || raw.name,
				available: isAvailable,
				// Only include price if it differs from the main product price
				price:
					variantPrice !== basePrice
						? {
								amount: variantPrice,
								currency: this.normalizeCurrency(v.currencyCode),
							}
						: null,
			};
		});
	}

	private extractAttributes(raw: any): { name: string; value: string | number | boolean }[] {
		// Explicitly type the array so TypeScript knows what it will contain
		const attributes: { name: string; value: string | number | boolean }[] = [];

		// Source 1: Facet Values (Global Attributes like "Brand", "Color")
		// Note: Requires query to fetch { facet { name } } to get the Attribute Name.
		if (Array.isArray(raw.facetValues)) {
			raw.facetValues.forEach((fv: any) => {
				// Skip if it looks like a Brand (handled separately)
				if (fv.facet?.name?.toLowerCase() === "brand") return;

				attributes.push({
					name: fv.facet?.name || "Feature", // Fallback if query doesn't fetch facet parent
					value: fv.name,
				});
			});
		}

		// Source 2: Variant Options (e.g., "Screen Size", "RAM")
		// We take the options from the first variant to populate general specs
		if (Array.isArray(raw.variants) && raw.variants.length > 0) {
			const firstVariant = raw.variants[0];
			if (Array.isArray(firstVariant.options)) {
				firstVariant.options.forEach((opt: any) => {
					// Avoid duplicates if already added via facets
					if (!attributes.find((a) => a.value === opt.name)) {
						attributes.push({
							name: opt.code || "Option", // "13-inch" (code) usually maps to a group code, but "name" is better if code is opaque
							value: opt.name, // "13 inch"
						});
					}
				});
			}
		}

		return attributes;
	}

	private extractBrand(raw: any): string {
		// Vendure doesn't have a native "Brand" field. It uses Facets.
		// Current Query: "facetValues { name }" -> Missing "facet { name }" parent.
		// If your query is updated to fetch facet parent, this works. Otherwise defaults to Generic.
		if (Array.isArray(raw.facetValues)) {
			const brandFacet = raw.facetValues.find((fv: any) => fv.facet && fv.facet.name.toLowerCase() === "brand");
			if (brandFacet) {
				return brandFacet.name;
			}
		}
		return "Generic";
	}

	private extractCategory(raw: any): string {
		if (Array.isArray(raw.collections) && raw.collections.length > 0) {
			return raw.collections.map((c: any) => c.name).join(" > ");
		}
		return "Uncategorized";
	}

	private extractImage(raw: any): string {
		// 1. Try Featured Asset Preview
		if (raw.featuredAsset && raw.featuredAsset.preview) return raw.featuredAsset.preview;
		if (raw.featuredAsset && raw.featuredAsset.source) return raw.featuredAsset.source;

		// 2. Try Assets Array
		if (Array.isArray(raw.assets) && raw.assets.length > 0) {
			return raw.assets[0].preview || raw.assets[0].source;
		}

		// 3. Try Variant Assets
		if (Array.isArray(raw.variants) && raw.variants.length > 0) {
			const v = raw.variants[0];
			if (v.assets && v.assets.length > 0) {
				return v.assets[0].preview || v.assets[0].source;
			}
		}

		return "";
	}

	private normalizeCurrency(code: string): "UAH" | "USD" | "EUR" {
		const safeCode = (code || "UAH").toUpperCase();
		const options = CurrencyEnum.options;

		if (options.includes(safeCode as any)) {
			return safeCode as "UAH" | "USD" | "EUR";
		}
		return "UAH";
	}

	private stripHtml(html: string): string {
		if (!html) return "";
		// Basic tag strip, then decode entities could be added if needed
		return html.replace(/<[^>]*>?/gm, "").trim();
	}

	private generateKeywords(title: string, description: string, category: string, brand: string): string[] {
		const rawText = `${title} ${category} ${brand} ${description}`.toLowerCase();
		const words = rawText
			.replace(/[^\w\s]/gi, "")
			.split(/\s+/)
			.filter((w) => w.length > 3)
			.filter((w) => !["with", "this", "that", "from", "have", "only", "features"].includes(w));

		return [...new Set(words)].slice(0, 10);
	}
}
