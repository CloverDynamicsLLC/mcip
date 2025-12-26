# API Reference

Complete reference for all MCIP HTTP endpoints.

## Base URL

```
http://localhost:8080
```

---

## Endpoints

### Health Check

Check if the service is running.

```http
GET /health
```

**Response:**

```json
{
  "status": "ok"
}
```

---

### Search Products

Search for products using natural language queries with automatic filter extraction.

```http
GET /search
```

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | Yes | — | Search query (natural language) |
| `take` | number | No | 10 | Number of results to return |
| `skip` | number | No | 0 | Number of results to skip (pagination) |

**Example Requests:**

```bash
# Simple search
curl "http://localhost:8080/search?q=laptop"

# With pagination
curl "http://localhost:8080/search?q=gaming+laptop&take=20&skip=0"

# Natural language with filters
curl "http://localhost:8080/search?q=nike+shoes+under+100"

# Exclusion filters
curl "http://localhost:8080/search?q=laptops+except+apple"
```

**Response:**

```json
{
  "meta": {
    "count": 5,
    "take": 10,
    "skip": 0,
    "q": "nike shoes under 100",
    "filteringStatus": "AI_FILTERED",
    "appliedFilters": {
      "brand": ["Nike"],
      "priceRange": {
        "min": null,
        "max": 100,
        "currency": "UAH"
      }
    }
  },
  "items": [
    {
      "externalId": "prod_123",
      "url": "https://store.com/products/nike-air-max",
      "title": "Nike Air Max 90",
      "description": "Classic sneakers with Air cushioning",
      "brand": "Nike",
      "category": "Shoes",
      "price": {
        "amount": 89.99,
        "currency": "USD"
      },
      "mainImage": "https://cdn.store.com/images/nike-air-max.jpg",
      "attributes": [
        { "name": "Color", "value": "White" },
        { "name": "Material", "value": "Leather" }
      ],
      "variants": [
        { "sku": "NAM90-W-42", "title": "White / 42", "price": null, "available": true }
      ],
      "keywords": ["nike", "sneakers", "running", "air max"],
      "score": 0.892
    }
  ]
}
```

**Filtering Status Values:**

| Status | Description |
|--------|-------------|
| `RAG_ONLY` | Pure vector search, no filters applied |
| `AI_FILTERED` | AI extracted and applied filters |

**Natural Language Filter Examples:**

| Query | Extracted Filters |
|-------|-------------------|
| `Nike shoes` | `brand: ["Nike"]` |
| `shoes under $100` | `priceMax: 100` |
| `laptops between 500 and 1000` | `priceMin: 500, priceMax: 1000` |
| `phones but not Samsung` | `excludeBrand: ["Samsung"]` |
| `gaming laptops except Asus` | `category: ["Gaming"], excludeBrand: ["Asus"]` |

---

### Import Products (Direct)

Import products from a specified URL. Useful for one-time imports or testing.

```http
POST /ingest/import-products
Content-Type: application/json
```

**Request Body:**

```json
{
  "url": "https://api.store.com/products",
  "apiKey": "optional-bearer-token",
  "graphqlQuery": "{ products { items { id name price } } }"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | API endpoint URL |
| `apiKey` | string | No | Bearer token for Authorization header |
| `graphqlQuery` | string | No | GraphQL query (if not provided, uses REST GET) |

**Example:**

```bash
# REST API
curl -X POST http://localhost:8080/ingest/import-products \
  -H "Content-Type: application/json" \
  -d '{"url": "https://api.store.com/products"}'

# GraphQL API
curl -X POST http://localhost:8080/ingest/import-products \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://store.com/graphql",
    "graphqlQuery": "{ products { items { id name } } }"
  }'
```

**Response:**

```json
{
  "status": "success",
  "message": "Queued 150 products from URL",
  "count": 150
}
```

---

### Admin: Sync Products

Trigger product synchronization from the configured source (environment variables).

```http
POST /admin/sync
x-admin-api-key: {ADMIN_API_KEY}
```

**Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| `x-admin-api-key` | Yes | Admin API key from `ADMIN_API_KEY` env |

**Example:**

```bash
curl -X POST http://localhost:8080/admin/sync \
  -H "x-admin-api-key: your-secret-admin-key"
```

**Response:**

```json
{
  "status": "success",
  "message": "Queued 150 products from URL",
  "count": 150
}
```

**Errors:**

```json
// Missing SOURCE_URL
{
  "statusCode": 400,
  "message": "SOURCE_URL environment variable is not set"
}

// Invalid API key
{
  "statusCode": 401,
  "message": "Invalid Admin API Key"
}
```

---

### Admin: Recreate Indexes

Rebuild Qdrant payload indexes. Useful after schema changes or to fix missing indexes.

```http
POST /admin/recreate-indexes
x-admin-api-key: {ADMIN_API_KEY}
```

**Example:**

```bash
curl -X POST http://localhost:8080/admin/recreate-indexes \
  -H "x-admin-api-key: your-secret-admin-key"
```

**Response:**

```json
{
  "message": "Indexes recreated successfully"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```

**Common Status Codes:**

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (invalid input) |
| 401 | Unauthorized (invalid API key) |
| 500 | Internal Server Error |

---

## Data Types

### UnifiedProduct

```typescript
interface UnifiedProduct {
  externalId: string;
  url: string;
  title: string;
  description: string;
  brand?: string;
  category?: string;
  price: {
    amount: number;
    currency: "UAH" | "USD" | "EUR";
  };
  mainImage: string;
  attributes: Array<{
    name: string;
    value: string | number | boolean;
  }>;
  variants: Array<{
    sku: string;
    title: string;
    price: { amount: number; currency: string } | null;
    available: boolean;
  }>;
  keywords: string[];
}
```

### SearchResult

```typescript
interface SearchResult extends UnifiedProduct {
  score: number;  // Similarity score (0-1)
}
```

### AppliedFilters

```typescript
interface AppliedFilters {
  brand?: string[];
  excludedBrand?: string[];
  priceRange?: {
    min?: number;
    max?: number;
    currency: string;
  };
  attributes?: Record<string, string>;
  excludedAttributes?: Record<string, string>;
}
```

---

## Rate Limits

There are no built-in rate limits. For production, consider:
- Adding rate limiting via reverse proxy (nginx, Traefik)
- Using API gateway (Kong, AWS API Gateway)

---

## CORS

CORS is not configured by default. To enable:

```typescript
// main.ts
const app = await NestFactory.create(AppModule);
app.enableCors({
  origin: ['https://your-frontend.com'],
  methods: ['GET', 'POST'],
});
```

---

## Webhooks (Future)

Planned webhook support for:
- Product sync completion
- Ingestion errors
- Index rebuilds

---

## OpenAPI/Swagger (Optional)

To add Swagger documentation:

```bash
npm install @nestjs/swagger swagger-ui-express
```

```typescript
// main.ts
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('MCIP API')
  .setDescription('Machine Customer Interaction Protocol API')
  .setVersion('1.0')
  .addApiKey({ type: 'apiKey', name: 'x-admin-api-key', in: 'header' }, 'admin-key')
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api', app, document);
```

Access at: `http://localhost:8080/api`
