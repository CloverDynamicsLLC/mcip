# Creating Custom Adapters

This guide explains how to create custom product mappers (adapters) to connect MCIP to any e-commerce data source.

## Overview

Adapters are responsible for transforming raw product data from your store into the `UnifiedProduct` schema that MCIP uses internally. The system includes:

- **VendureMapper** — For Vendure e-commerce platform
- **CustomAiMapper** — AI-powered fallback for any data format

You can create custom adapters for Shopify, WooCommerce, Magento, or any proprietary system.

## Architecture

```
Raw Data (API Response)
         ↓
    ProductMapper.map()
         ↓
    UnifiedProduct (Validated)
         ↓
    VectorizationService
         ↓
    Qdrant Storage
```

---

## Step 1: Understand the Interface

All mappers implement `ProductMapper`:

```typescript
// src/modules/ingestion/mapper/product-mapper.interface.ts

import { UnifiedProduct } from "../../../domain/product.schema";

export interface ProductMapper {
  map(raw: any): Promise<UnifiedProduct>;
}
```

The `map()` method receives raw product data and must return a valid `UnifiedProduct`.

---

## Step 2: Understand the Target Schema

Your mapper must produce this structure:

```typescript
// src/domain/product.schema.ts

interface UnifiedProduct {
  // Identity
  externalId: string;          // Unique ID from source (e.g., "prod_123")
  url: string;                 // Product page URL

  // Core Content
  title: string;               // Clean product name (min 3 chars)
  description: string;         // Plain text, no HTML

  // Categorization (optional but recommended)
  brand?: string;              // "Nike", "Apple", etc.
  category?: string;           // "Laptops", "Shoes", etc.

  // Commercial
  price: {
    amount: number;            // e.g., 99.99
    currency: "UAH" | "USD" | "EUR";
  };

  // Visuals
  mainImage: string;           // Primary image URL

  // Details
  attributes: Array<{
    name: string;              // e.g., "Color"
    value: string | number | boolean;  // e.g., "Red"
  }>;

  variants: Array<{
    sku: string;               // Stock keeping unit
    title: string;             // e.g., "Red / XL"
    price: { amount: number; currency: string } | null;
    available: boolean;
  }>;

  // AI Metadata
  keywords: string[];          // 5-10 SEO keywords
}
```

---

## Step 3: Create Your Mapper

### Example: Shopify Mapper

Create a new file:

```typescript
// src/modules/ingestion/mapper/strategies/shopify/shopify.mapper.ts

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UnifiedProduct, UnifiedProductSchema } from "../../../../../domain/product.schema";
import { ProductMapper } from "../../product-mapper.interface";

// Define Shopify's product structure
interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  handle: string;
  images: Array<{ src: string }>;
  variants: Array<{
    id: number;
    sku: string;
    title: string;
    price: string;
    available: boolean;
  }>;
  tags: string;
}

@Injectable()
export class ShopifyMapper implements ProductMapper {
  private readonly logger = new Logger(ShopifyMapper.name);

  constructor(private readonly configService: ConfigService) {}

  async map(raw: any): Promise<UnifiedProduct> {
    // 1. Validate input
    if (!raw || typeof raw !== "object" || !raw.id) {
      throw new Error("Invalid Shopify product: missing ID");
    }

    const shopifyProduct = raw as ShopifyProduct;
    this.logger.debug(`Mapping Shopify product: ${shopifyProduct.title}`);

    // 2. Extract base price from first variant
    const basePrice = shopifyProduct.variants[0]
      ? parseFloat(shopifyProduct.variants[0].price)
      : 0;

    // 3. Build unified product
    const storefrontUrl = this.configService.get<string>("STOREFRONT_URL", "");
    
    const product: UnifiedProduct = {
      externalId: String(shopifyProduct.id),
      url: `${storefrontUrl}/products/${shopifyProduct.handle}`,
      
      title: shopifyProduct.title,
      description: this.stripHtml(shopifyProduct.body_html || ""),
      
      brand: shopifyProduct.vendor || undefined,
      category: shopifyProduct.product_type || undefined,
      
      price: {
        amount: basePrice,
        currency: this.getCurrency(),
      },
      
      mainImage: shopifyProduct.images[0]?.src || "",
      
      attributes: this.extractAttributes(shopifyProduct),
      variants: this.mapVariants(shopifyProduct.variants, basePrice),
      
      keywords: this.generateKeywords(shopifyProduct),
    };

    // 4. Validate with Zod schema
    return UnifiedProductSchema.parse(product);
  }

  private getCurrency(): "UAH" | "USD" | "EUR" {
    const currency = this.configService.get<string>("STORE_CURRENCY", "USD");
    if (["UAH", "USD", "EUR"].includes(currency)) {
      return currency as "UAH" | "USD" | "EUR";
    }
    return "USD";
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>?/gm, "").trim();
  }

  private extractAttributes(product: ShopifyProduct): Array<{ name: string; value: string }> {
    const attributes: Array<{ name: string; value: string }> = [];
    
    // Add vendor as attribute if present
    if (product.vendor) {
      attributes.push({ name: "Vendor", value: product.vendor });
    }
    
    // Add product type
    if (product.product_type) {
      attributes.push({ name: "Type", value: product.product_type });
    }
    
    return attributes;
  }

  private mapVariants(
    variants: ShopifyProduct["variants"],
    basePrice: number
  ): UnifiedProduct["variants"] {
    return variants.map((v) => {
      const variantPrice = parseFloat(v.price);
      return {
        sku: v.sku || `VAR-${v.id}`,
        title: v.title,
        available: v.available,
        price: variantPrice !== basePrice
          ? { amount: variantPrice, currency: this.getCurrency() }
          : null,
      };
    });
  }

  private generateKeywords(product: ShopifyProduct): string[] {
    const keywords: string[] = [];
    
    // Split title into words
    const titleWords = product.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    keywords.push(...titleWords);
    
    // Add tags
    if (product.tags) {
      const tags = product.tags.split(",").map((t) => t.trim().toLowerCase());
      keywords.push(...tags);
    }
    
    // Add vendor and type
    if (product.vendor) keywords.push(product.vendor.toLowerCase());
    if (product.product_type) keywords.push(product.product_type.toLowerCase());
    
    // Dedupe and limit
    return [...new Set(keywords)].slice(0, 10);
  }
}
```

### Type Definitions (Optional but Recommended)

Create a types file for better type safety:

```typescript
// src/modules/ingestion/mapper/strategies/shopify/types.ts

export interface ShopifyImage {
  id: number;
  src: string;
  width: number;
  height: number;
  alt: string | null;
}

export interface ShopifyVariant {
  id: number;
  product_id: number;
  sku: string;
  title: string;
  price: string;
  compare_at_price: string | null;
  available: boolean;
  inventory_quantity: number;
  weight: number;
  weight_unit: string;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  handle: string;
  status: "active" | "archived" | "draft";
  tags: string;
  images: ShopifyImage[];
  variants: ShopifyVariant[];
  created_at: string;
  updated_at: string;
}
```

---

## Step 4: Register the Mapper

Update the ingestion module to include your mapper:

```typescript
// src/modules/ingestion/ingestion.module.ts

import { Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CustomAiMapper } from "./mapper/strategies/custom-ai.mapper";
import { VendureMapper } from "./mapper/strategies/vendure/vendure.mapper";
import { ShopifyMapper } from "./mapper/strategies/shopify/shopify.mapper";  // Add import
import { PRODUCT_MAPPER } from "../../constants/tokens";
// ... other imports

@Module({
  providers: [
    {
      provide: PRODUCT_MAPPER,
      useFactory: (
        configService: ConfigService,
        customAiMapper: CustomAiMapper,
        vendureMapper: VendureMapper,
        shopifyMapper: ShopifyMapper  // Add to factory
      ) => {
        const storeProvider = configService.get<string>("STORE_PROVIDER", "VENDURE");
        Logger.log(`Using store provider: ${storeProvider}`);
        
        switch (storeProvider.toLowerCase()) {
          case "vendure":
            return vendureMapper;
          case "shopify":           // Add case
            return shopifyMapper;
          default:
            return customAiMapper;
        }
      },
      inject: [ConfigService, CustomAiMapper, VendureMapper, ShopifyMapper],  // Add to inject
    },
    // ... other providers
    CustomAiMapper,
    VendureMapper,
    ShopifyMapper,  // Add to providers
  ],
})
export class IngestionModule {}
```

---

## Step 5: Configure Environment

Set `STORE_PROVIDER` to use your mapper:

```env
STORE_PROVIDER=SHOPIFY
SOURCE_URL=https://your-store.myshopify.com/admin/api/2024-01/products.json
SOURCE_API_KEY=your-shopify-api-key
STORE_CURRENCY=USD
STOREFRONT_URL=https://your-store.myshopify.com
```

---

## Common Patterns

### Pattern 1: Price Normalization

Many platforms store prices in cents:

```typescript
private normalizePrice(rawPrice: number): number {
  // Vendure stores 12999 = $129.99
  return rawPrice / 100;
}
```

### Pattern 2: Currency Mapping

Ensure currency codes match the schema:

```typescript
private normalizeCurrency(code: string): "UAH" | "USD" | "EUR" {
  const mapping: Record<string, "UAH" | "USD" | "EUR"> = {
    "usd": "USD",
    "eur": "EUR",
    "uah": "UAH",
    "us dollar": "USD",
    "euro": "EUR",
    "гривня": "UAH",
  };
  return mapping[code.toLowerCase()] || "USD";
}
```

### Pattern 3: HTML Stripping

Always clean HTML from descriptions:

```typescript
private stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
```

### Pattern 4: Keyword Generation

Generate searchable keywords:

```typescript
private generateKeywords(product: RawProduct): string[] {
  const text = `${product.title} ${product.description} ${product.category}`.toLowerCase();
  
  // Remove common words
  const stopWords = ["the", "and", "for", "with", "this", "that"];
  
  const words = text
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .filter((w) => !stopWords.includes(w));
  
  return [...new Set(words)].slice(0, 10);
}
```

### Pattern 5: Image URL Transformation

Handle internal vs public URLs:

```typescript
private transformImageUrl(url: string): string {
  const internalHost = this.configService.get("INTERNAL_HOST");
  const publicHost = this.configService.get("PUBLIC_HOST");
  
  if (internalHost && publicHost && url.includes(internalHost)) {
    return url.replace(internalHost, publicHost);
  }
  return url;
}
```

---

## Using the AI Fallback Mapper

If your data format is unusual, you can use `CustomAiMapper` which uses GPT-4 to intelligently map any structure:

```env
STORE_PROVIDER=CUSTOM
```

The AI mapper:
1. Sends raw product JSON to GPT-4
2. GPT-4 extracts fields using structured output (Zod schema)
3. Infers missing fields (category from title, brand from description)
4. Cleans and normalizes data

**Pros:** Works with any data format  
**Cons:** Slower, uses API credits, less predictable

---

## Testing Your Mapper

### Unit Test Example

```typescript
// src/modules/ingestion/mapper/strategies/shopify/shopify.mapper.spec.ts

import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { ShopifyMapper } from "./shopify.mapper";

describe("ShopifyMapper", () => {
  let mapper: ShopifyMapper;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopifyMapper,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              const config = {
                STOREFRONT_URL: "https://example.com",
                STORE_CURRENCY: "USD",
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    mapper = module.get<ShopifyMapper>(ShopifyMapper);
  });

  it("should map a valid Shopify product", async () => {
    const rawProduct = {
      id: 123,
      title: "Cool T-Shirt",
      body_html: "<p>A very cool shirt</p>",
      vendor: "Acme",
      product_type: "Apparel",
      handle: "cool-t-shirt",
      images: [{ src: "https://cdn.shopify.com/image.jpg" }],
      variants: [
        { id: 1, sku: "TSHIRT-S", title: "Small", price: "29.99", available: true },
      ],
      tags: "summer,cotton",
    };

    const result = await mapper.map(rawProduct);

    expect(result.externalId).toBe("123");
    expect(result.title).toBe("Cool T-Shirt");
    expect(result.description).toBe("A very cool shirt");
    expect(result.brand).toBe("Acme");
    expect(result.price.amount).toBe(29.99);
    expect(result.price.currency).toBe("USD");
    expect(result.keywords).toContain("cotton");
  });

  it("should throw on invalid input", async () => {
    await expect(mapper.map(null)).rejects.toThrow();
    await expect(mapper.map({})).rejects.toThrow();
  });
});
```

---

## Directory Structure

After creating a mapper, your structure should look like:

```
src/modules/ingestion/mapper/
├── product-mapper.interface.ts
└── strategies/
    ├── custom-ai.mapper.ts
    ├── vendure/
    │   ├── types.ts
    │   └── vendure.mapper.ts
    └── shopify/                  # Your new mapper
        ├── types.ts
        └── shopify.mapper.ts
```

---

## Next Steps

- [Architecture Overview](./architecture.md) — Understand the full system
- [API Reference](./api-reference.md) — Test your integration
- [Configuration](./configuration.md) — All environment options
