import { z } from 'zod';

/**
 * Currency Enum.
 * We restrict this to ensure we don't get random strings like 'usd' or 'US Dollar'.
 */
export const CurrencyEnum = z.enum(["UAH", "USD", "EUR"]);

/**
 * Price Schema.
 * Uses z.coerce to safely handle number-like strings from LLM (e.g., "100.50").
 */
const PriceSchema = z.object({
	amount: z.coerce.number().min(0).describe("The current selling price of the item"),
	currency: CurrencyEnum.default("UAH").describe("ISO 4217 currency code"),
});

/**
 * Product Attribute Schema.
 * Flattened key-value pair for technical specifications.
 * Example: { name: "Material", value: "Cotton" }
 */
const AttributeSchema = z.object({
	name: z.string().describe("Name of the attribute (e.g. Color, RAM, Material)"),
	value: z.union([z.string(), z.number(), z.boolean()]).describe("Value of the attribute"),
});

/**
 * Product Variant Schema (Simplified).
 * Represents a specific SKU (Stock Keeping Unit).
 */
const VariantSchema = z.object({
	sku: z.string().describe("Unique identifier for this specific variant"),
	title: z.string().describe('Variant specific name (e.g. "Red / XL")'),
	price: PriceSchema.nullable().describe("Override price if different from base price"),
	available: z.boolean().default(true).describe("Is this specific variant in stock?"),
});

/**
 * MAIN SCHEMA: Unified Product.
 * This is the contract we enforce on the LLM.
 */
export const UnifiedProductSchema = z.object({
	// --- Identity ---
	externalId: z.string().describe("Unique ID from the source shop system"),
	url: z.string().describe("Direct link to the product page"),

	// --- Core Content (Optimized for Search) ---
	title: z.string().min(3).describe("Clean product title, no marketing caps lock"),
	description: z.string().describe("Clear text description, HTML tags removed"),

	// --- Classification ---
	category: z.string().describe('Main category (e.g. "Electronics > Smartphones")'),
	brand: z.string().describe('Brand name normalized (e.g. "Apple")'),

	// --- Commercial Data ---
	price: PriceSchema.describe("Base price of the product"),

	// --- Visuals ---
	mainImage: z.string().describe("URL of the primary product image"),

	// --- Details ---
	attributes: z.array(AttributeSchema).default([]).describe("Technical specs list"),
	variants: z.array(VariantSchema).default([]).describe("List of available options"),

	// --- AI Generated Metadata ---
	// This field is crucial for the Hybrid Search (Vector Search)
	keywords: z.array(z.string()).describe("Array of 5-10 search keywords, synonyms, or related terms for SEO"),
});

// Exporting TypeScript types derived from the Zod schema
export type UnifiedProduct = z.infer<typeof UnifiedProductSchema>;
export type ProductVariant = z.infer<typeof VariantSchema>;
