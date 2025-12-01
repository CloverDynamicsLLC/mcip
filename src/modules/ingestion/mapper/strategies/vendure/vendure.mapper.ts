import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
	CurrencyEnum,
	ProductVariant,
	UnifiedProduct,
	UnifiedProductSchema,
} from "../../../../../domain/product.schema";
import { ProductMapper } from "../../product-mapper.interface";
import { VendureProduct } from "./types";

@Injectable()
export class VendureMapper implements ProductMapper {
	private readonly logger = new Logger(VendureMapper.name);

	constructor(private readonly configService: ConfigService) {}

	async map(raw: any): Promise<UnifiedProduct> {
		// 1. Validation & Casting
		if (!raw || typeof raw !== "object" || !raw.id) {
			throw new Error("Invalid raw product data: Missing ID or object structure");
		}

		const vendureProduct = raw as VendureProduct;
		this.logger.debug(`Mapping Vendure Product: ${vendureProduct.name} (ID: ${vendureProduct.id})`);

		// 2. Extract Core Data Helpers
		const priceData = this.extractPrice(vendureProduct);
		const brand = this.extractBrand(vendureProduct);
		const category = this.extractCategory(vendureProduct);
		const attributes = this.extractAttributes(vendureProduct);
		const mainImage = this.extractImage(vendureProduct);

		// 3. Construct the Unified Object
		const storefrontUrl = this.configService.get<string>("STOREFRONT_URL", "");
		const product: UnifiedProduct = {
			externalId: String(vendureProduct.id),
			url: vendureProduct.slug ? `${storefrontUrl}/products/${vendureProduct.slug}` : "",
			title: vendureProduct.name || "Untitled Product",
			description: this.stripHtml(vendureProduct.description || ""),


			price: {
				amount: priceData.amount,
				currency: priceData.currency,
			},
			mainImage: mainImage,
			attributes: this.mergeAttributes(attributes, brand, category),
			variants: this.extractVariants(vendureProduct, priceData.amount),
			keywords: this.generateKeywords(vendureProduct.name, vendureProduct.description, category, brand),
		};

		// 4. Zod Validation
		try {
			return UnifiedProductSchema.parse(product);
		} catch (error) {
			this.logger.error(`Zod Validation Failed for product ${vendureProduct.id}`, error);
			throw error;
		}
	}

	// --- Extraction Helpers ---

	private extractPrice(product: VendureProduct): { amount: number; currency: "UAH" | "USD" | "EUR" } {
		let rawAmount = 0;
		let rawCurrency = "UAH";

		// Vendure logic: Products have variants. Usually we take the first variant's price as the "From" price.
		if (Array.isArray(product.variants) && product.variants.length > 0) {
			const firstVariant = product.variants[0];
			rawAmount = firstVariant.priceWithTax ?? firstVariant.price ?? 0;
			rawCurrency = firstVariant.currencyCode || "UAH";
		}

		// Normalize Currency
		const currency = this.normalizeCurrency(rawCurrency);

		// Normalize Amount (Vendure stores cents, e.g. 129900 = 1299.00)
		const amount = rawAmount / 100;

		return { amount, currency };
	}

	private extractVariants(product: VendureProduct, basePrice: number): ProductVariant[] {
		if (!Array.isArray(product.variants)) return [];

		return product.variants.map((v) => {
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
				title: v.name || product.name,
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

	private extractAttributes(product: VendureProduct): { name: string; value: string | number | boolean }[] {
		const attributes: { name: string; value: string | number | boolean }[] = [];
		const seenValues = new Set<string>();

		// Source 1: Facet Values (Global Attributes like "Brand", "Color")
		if (Array.isArray(product.facetValues)) {
			product.facetValues.forEach((fv) => {
				let facetName = fv.facet?.name;
				const value = fv.name;

				const key = `${facetName || "Feature"}:${value}`;
				if (!seenValues.has(key)) {
					attributes.push({
						name: facetName || "Feature",
						value: value,
					});
					seenValues.add(key);
				}
			});
		}

		// Source 2: Variant Options (e.g., "Screen Size", "RAM")
		// We take the options from the first variant to populate general specs if they aren't already covered
		if (Array.isArray(product.variants) && product.variants.length > 0) {
			const firstVariant = product.variants[0];
			if (Array.isArray(firstVariant.options)) {
				firstVariant.options.forEach((opt) => {
						const name = opt.code || "Option";
					const value = opt.name;

					// Simple de-duplication against existing attributes by value might be too aggressive,
					// but let's check if we already have this value.
					const existing = attributes.find((a) => a.value === value);
					if (!existing) {
						attributes.push({
							name: name,
							value: value,
						});
					}
				});
			}
		}

		return attributes;
	}

	private extractBrand(product: VendureProduct): string {
		// Vendure doesn't have a native "Brand" field. It uses Facets.
		if (Array.isArray(product.facetValues)) {
			const brandFacet = product.facetValues.find((fv) => fv.facet && fv.facet.name.toLowerCase() === "brand");
			if (brandFacet) {
				return brandFacet.name;
			}
		}
		return "Generic";
	}

	private extractCategory(product: VendureProduct): string {
		// Priority 1: Facet "category"
		if (Array.isArray(product.facetValues)) {
			const categoryFacets = product.facetValues.filter(
				(fv) => fv.facet && fv.facet.name.toLowerCase() === "category"
			);
			if (categoryFacets.length > 0) {
				// Join multiple categories if present, or just take the last one (most specific)
				// Usually hierarchical facets are returned. Let's join them.
				return categoryFacets.map((f) => f.name).join(" > ");
			}
		}

		// Priority 2: Collections
		if (Array.isArray(product.collections) && product.collections.length > 0) {
			return product.collections.map((c) => c.name).join(" > ");
		}

		return "Uncategorized";
	}

	private extractImage(product: VendureProduct): string {
		let imageUrl = "";

		// 1. Try Featured Asset Preview
		if (product.featuredAsset?.preview) imageUrl = product.featuredAsset.preview;
		else if (product.featuredAsset?.source) imageUrl = product.featuredAsset.source;

		// 2. Try Assets Array
		else if (Array.isArray(product.assets) && product.assets.length > 0) {
			imageUrl = product.assets[0].preview || product.assets[0].source;
		}

		// 3. Try Variant Assets
		else if (Array.isArray(product.variants) && product.variants.length > 0) {
			const v = product.variants[0];
			if (v.assets && v.assets.length > 0) {
				imageUrl = v.assets[0].preview || v.assets[0].source;
			}
		}

		return this.replaceBaseUrl(imageUrl);
	}

	private replaceBaseUrl(url: string): string {
		if (!url) return "";

		const internalUrl = this.configService.get<string>("VENDURE_INTERNAL_URL", "http://store-alpha-backend:3000");
		const apiUrl = this.configService.get<string>("VENDURE_API_URL", "");
		
		if (!apiUrl) return url;

		// Derive public base URL from API URL (remove /shop-api or /admin-api suffix if present, or just use as is if it's the root)
		const publicBaseUrl = apiUrl.replace(/\/shop-api\/?$/, "").replace(/\/admin-api\/?$/, "");

		if (url.startsWith(internalUrl)) {
			return url.replace(internalUrl, publicBaseUrl);
		}

		return url;
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
		// Basic tag strip
		return html.replace(/<[^>]*>?/gm, "").trim();
	}

	private generateKeywords(title: string, description: string, category: string, brand: string): string[] {
		const rawText = `${title} ${category} ${brand} ${description}`.toLowerCase();
		const words = rawText
			.replace(/[^\w\s]/gi, "")
			.split(/\s+/)
			.filter((w) => w.length > 3)
			.filter(
				(w) => !["with", "this", "that", "from", "have", "only", "features", "laptop", "gaming"].includes(w)
			);

		return [...new Set(words)].slice(0, 10);
	}

	private mergeAttributes(
		existingAttributes: { name: string; value: string | number | boolean }[],
		brand: string,
		category: string
	): { name: string; value: string | number | boolean }[] {
		const merged = [...existingAttributes];

		// Add Brand if not present
		if (brand && brand !== "Generic" && !merged.some((a) => a.name.toLowerCase() === "brand")) {
			merged.push({ name: "brand", value: brand });
		}

		// Add Category if not present
		if (
			category &&
			category !== "Uncategorized" &&
			!merged.some((a) => a.name.toLowerCase() === "category")
		) {
			merged.push({ name: "category", value: category });
		}

		return merged;
	}
}

