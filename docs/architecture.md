# Architecture Overview

This document describes the internal architecture of MCIP (Machine Customer Interaction Protocol), its modules, and data flow.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              MCIP                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐   │
│  │    Admin     │    │   Search     │    │       Ingestion          │   │
│  │  Controller  │    │  Controller  │    │       Controller         │   │
│  └──────┬───────┘    └──────┬───────┘    └────────────┬─────────────┘   │
│         │                   │                         │                  │
│         ▼                   ▼                         ▼                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                        Service Layer                              │   │
│  │  ┌─────────────┐  ┌────────────────┐  ┌───────────────────────┐  │   │
│  │  │  Ingestion  │  │ Vectorization  │  │   Feature Extraction  │  │   │
│  │  │   Service   │  │    Service     │  │       Service         │  │   │
│  │  └──────┬──────┘  └───────┬────────┘  └───────────┬───────────┘  │   │
│  └─────────┼─────────────────┼───────────────────────┼──────────────┘   │
│            │                 │                       │                  │
│            ▼                 ▼                       ▼                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐   │
│  │   Product    │    │   OpenAI     │    │   Product Repository     │   │
│  │   Mapper     │    │              │    │       (Qdrant)           │   │
│  └──────────────┘    └──────────────┘    └──────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                    │                              │
                    ▼                              ▼
            ┌──────────────┐              ┌──────────────┐
            │    Redis     │              │    Qdrant    │
            │   (Queue)    │              │  (Vector DB) │
            └──────────────┘              └──────────────┘
```

## Module Structure

```
src/
├── main.ts                    # Application entry point
├── app.module.ts              # Root module
├── app.controller.ts          # Health check endpoint
├── constants/
│   └── tokens.ts              # Dependency injection tokens
├── domain/
│   └── product.schema.ts      # Unified product schema (Zod)
└── modules/
    ├── admin/                 # Admin operations
    ├── ingestion/             # Product ingestion pipeline
    ├── repository/            # Data persistence (Qdrant)
    ├── search/                # Search functionality
    └── vectorization/         # Embedding generation
```

---

## Core Modules

### 1. Ingestion Module

Handles fetching, normalizing, and queueing products for processing.

```
modules/ingestion/
├── ingestion.module.ts          # Module definition
├── ingestion.controller.ts      # HTTP endpoints
├── ingestion.processor.ts       # BullMQ worker
├── dto/                         # Request/Response DTOs
├── mapper/
│   ├── product-mapper.interface.ts
│   └── strategies/
│       ├── vendure/
│       │   ├── vendure.mapper.ts
│       │   └── types.ts
│       └── custom-ai.mapper.ts
└── services/
    ├── ingestion.service.interface.ts
    └── impl/
        └── ingestion.service.ts
```

**Key Components:**

- **IngestionService** — Fetches data from REST/GraphQL endpoints
- **ProductMapper** — Transforms raw data to `UnifiedProduct` schema
- **IngestionProcessor** — BullMQ worker that processes queue jobs

**Data Flow:**
```
HTTP Request → IngestionService → Queue (BullMQ)
                                      ↓
                              IngestionProcessor
                                      ↓
                              ProductMapper.map()
                                      ↓
                              VectorizationService.embedProduct()
                                      ↓
                              ProductRepository.save()
```

### 2. Repository Module

Manages product persistence in Qdrant vector database.

```
modules/repository/
├── repository.module.ts
├── interfaces/
│   └── product.repository.interface.ts
├── impl/
│   └── qdrant.product.repository.ts
└── utils/
    └── id-generator.ts
```

**ProductRepository Interface:**

```typescript
interface ProductRepository {
  save(product: UnifiedProduct, vector: number[]): Promise<void>;
  search(queryVector: number[], limit?: number, offset?: number): Promise<SearchResult[]>;
  hybridSearch(queryVector: number[], filters: SearchFilters, limit?: number, offset?: number): Promise<SearchResult[]>;
  getFacets(): Promise<FacetResult>;
  delete(id: string): Promise<void>;
  recreateIndexes(): Promise<void>;
}
```

**Qdrant Collection Configuration:**
- Vector size: 1536 (OpenAI `text-embedding-3-small`)
- Distance metric: Cosine
- Payload indexes: `price.amount` (float), `category` (keyword), `brand` (keyword)

### 3. Vectorization Module

Generates embeddings using OpenAI.

```
modules/vectorization/
├── vectorization.module.ts
└── services/
    ├── vectorization.service.interface.ts
    └── impl/
        └── openai.vectorization.service.ts
```

**VectorizationService Interface:**

```typescript
interface VectorizationService {
  embedString(query: string): Promise<number[]>;
  embedProduct(product: UnifiedProduct): Promise<number[]>;
}
```

**Product Embedding Strategy:**

Products are converted to a searchable text blob before embedding:

```typescript
const textToEmbed = `
  Title: ${product.title}
  Description: ${product.description}
  Keywords: ${product.keywords.join(", ")}
  Attributes: ${product.attributes.map(a => `${a.name}: ${a.value}`).join(", ")}
`;
```

### 4. Search Module

Handles semantic search with AI-powered filter extraction.

```
modules/search/
├── search.module.ts
├── search.controller.ts
├── dto/
│   ├── search-request.dto.ts
│   └── search-response.dto.ts
├── interfaces/
│   ├── extracted-filters.interface.ts
│   └── search-service-result.interface.ts
└── services/
    ├── search.service.interface.ts
    ├── feature-extraction.service.interface.ts
    └── impl/
        ├── search.service.ts
        └── feature-extraction.service.ts
```

**Search Flow:**

```
Query: "Nike shoes under $100 but not running"
              ↓
    FeatureExtractionService
              ↓
    Extracted: {
      brand: ["Nike"],
      excludeCategory: ["Running"],
      priceMax: 100,
      searchQuery: "shoes"
    }
              ↓
    VectorizationService.embedString("shoes")
              ↓
    ProductRepository.hybridSearch(vector, filters)
              ↓
    Results with scores
```

**FeatureExtractionService:**

Uses OpenAI structured output (Zod schema) to extract:
- Brand filters (inclusion/exclusion)
- Category filters (inclusion/exclusion)
- Price range (min/max)
- Clean search query

### 5. Admin Module

Protected endpoints for administrative operations.

```
modules/admin/
├── admin.module.ts
├── admin.controller.ts
└── guards/
    └── admin.guard.ts
```

**Endpoints:**
- `POST /admin/sync` — Trigger product sync from source
- `POST /admin/recreate-indexes` — Rebuild Qdrant indexes

**Authentication:** 
Header-based API key (`x-admin-api-key`)

---

## Unified Product Schema

All products are normalized to this schema before storage:

```typescript
const UnifiedProductSchema = z.object({
  // Identity
  externalId: z.string(),           // ID from source system
  url: z.string(),                  // Product page URL

  // Core Content
  title: z.string().min(3),         // Clean product title
  description: z.string(),          // Plain text description

  // Categorization
  brand: z.string().optional(),     // Brand name
  category: z.string().optional(),  // Product category

  // Commercial
  price: PriceSchema,               // { amount: number, currency: "UAH"|"USD"|"EUR" }

  // Visuals
  mainImage: z.string(),            // Primary image URL

  // Details
  attributes: z.array(AttributeSchema),  // Technical specs
  variants: z.array(VariantSchema),      // SKU variants

  // AI Metadata
  keywords: z.array(z.string()),    // SEO keywords
});
```

---

## Dependency Injection

The project uses NestJS DI with Symbol tokens for loose coupling:

```typescript
// constants/tokens.ts
export const INGESTION_SERVICE = Symbol("INGESTION_SERVICE");
export const VECTORIZATION_SERVICE = Symbol("VECTORIZATION_SERVICE");
export const SEARCH_SERVICE = Symbol("SEARCH_SERVICE");
export const FEATURE_EXTRACTION_SERVICE = Symbol("FEATURE_EXTRACTION_SERVICE");
export const PRODUCT_MAPPER = Symbol("PRODUCT_MAPPER");
export const PRODUCT_REPOSITORY = Symbol("PRODUCT_REPOSITORY");
```

**Usage in modules:**

```typescript
@Module({
  providers: [
    {
      provide: PRODUCT_MAPPER,
      useFactory: (config, vendureMapper, customMapper) => {
        return config.get("STORE_PROVIDER") === "VENDURE" 
          ? vendureMapper 
          : customMapper;
      },
      inject: [ConfigService, VendureMapper, CustomAiMapper],
    },
  ],
})
```

---

## Queue System

BullMQ manages product processing jobs:

**Queue Name:** `product-ingestion`

**Job Structure:**
```typescript
{
  name: "process-product",
  data: rawProduct,
  opts: { 
    removeOnComplete: true, 
    attempts: 3 
  }
}
```

**Processor Flow:**
1. Receive raw product from queue
2. Map to `UnifiedProduct` via adapter
3. Generate embedding vector
4. Save to Qdrant

---

## Configuration

All config is loaded via `@nestjs/config`:

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),
  ],
})
export class AppModule {}
```

---

## Next Steps

- [Custom Adapters](./custom-adapters.md) — Create your own product mapper
- [API Reference](./api-reference.md) — All endpoints and parameters
