# Configuration

Complete reference for all environment variables and configuration options.

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key for embeddings and AI features | `sk-proj-abc123...` |

### Data Source

| Variable | Description | Default |
|----------|-------------|---------|
| `SOURCE_URL` | URL to fetch products from | `https://demo.vendure.io/shop-api` |
| `SOURCE_API_KEY` | Bearer token for source API (optional) | — |
| `STORE_PROVIDER` | Adapter to use: `VENDURE`, `SHOPIFY`, or `CUSTOM` | `VENDURE` |
| `GRAPHQL_QUERY` | GraphQL query string (for GraphQL sources) | — |

### Server

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `8080` |
| `NODE_ENV` | Environment: `development`, `production` | `production` |

### Infrastructure

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_HOST` | Redis hostname | `redis` |
| `REDIS_PORT` | Redis port | `6379` |
| `QDRANT_URL` | Qdrant vector database URL | `http://qdrant:6333` |

### Security

| Variable | Description | Default |
|----------|-------------|---------|
| `ADMIN_API_KEY` | API key for admin endpoints | `secret-admin-key` |

### Storefront Integration

| Variable | Description | Default |
|----------|-------------|---------|
| `STOREFRONT_URL` | Public URL of your store (for product links) | — |
| `VENDURE_INTERNAL_URL` | Internal Vendure URL (for image URL replacement) | `http://store-alpha-backend:3000` |
| `VENDURE_API_URL` | Public Vendure API URL | — |
| `STORE_CURRENCY` | Default currency for custom mappers | `USD` |

---

## Configuration Examples

### Vendure (GraphQL)

```env
# Required
OPENAI_API_KEY=sk-proj-your-key

# Vendure Source
SOURCE_URL=https://your-vendure.com/shop-api
STORE_PROVIDER=VENDURE
GRAPHQL_QUERY={products{items{id name slug description variants{id sku name price priceWithTax currencyCode stockLevel options{code name}assets{preview source}}facetValues{name facet{name}}collections{name slug}featuredAsset{preview source}assets{preview source}}}}

# Storefront
STOREFRONT_URL=https://your-store.com
VENDURE_API_URL=https://your-vendure.com/shop-api

# Security
ADMIN_API_KEY=super-secret-key-change-me

# Infrastructure (Docker defaults)
REDIS_HOST=redis
QDRANT_URL=http://qdrant:6333
PORT=8080
```

### Shopify (REST)

```env
# Required
OPENAI_API_KEY=sk-proj-your-key

# Shopify Source
SOURCE_URL=https://your-store.myshopify.com/admin/api/2024-01/products.json
SOURCE_API_KEY=shpat_xxxxx
STORE_PROVIDER=SHOPIFY
STORE_CURRENCY=USD

# Storefront
STOREFRONT_URL=https://your-store.myshopify.com

# Security
ADMIN_API_KEY=super-secret-key

# Infrastructure
REDIS_HOST=redis
QDRANT_URL=http://qdrant:6333
```

### Custom REST API

```env
# Required
OPENAI_API_KEY=sk-proj-your-key

# Custom Source (AI-powered mapping)
SOURCE_URL=https://api.your-store.com/v1/products
SOURCE_API_KEY=your-api-key
STORE_PROVIDER=CUSTOM

# Storefront
STOREFRONT_URL=https://your-store.com

# Security
ADMIN_API_KEY=super-secret-key

# Infrastructure
REDIS_HOST=redis
QDRANT_URL=http://qdrant:6333
```

### Local Development

```env
# Required
OPENAI_API_KEY=sk-proj-your-key

# Demo Source
SOURCE_URL=https://demo.vendure.io/shop-api
STORE_PROVIDER=VENDURE

# Local Infrastructure
REDIS_HOST=localhost
QDRANT_URL=http://localhost:6333

# Development Settings
PORT=3000
NODE_ENV=development
ADMIN_API_KEY=dev-admin-key
```

---

## GraphQL Query Examples

### Vendure Full Query

```graphql
{
  products {
    items {
      id
      name
      slug
      description
      variants {
        id
        sku
        name
        price
        priceWithTax
        currencyCode
        stockLevel
        options {
          code
          name
        }
        assets {
          preview
          source
        }
      }
      facetValues {
        name
        facet {
          name
        }
      }
      collections {
        name
        slug
      }
      featuredAsset {
        preview
        source
      }
      assets {
        preview
        source
      }
    }
  }
}
```

**Minified for ENV:**

```
{products{items{id name slug description variants{id sku name price priceWithTax currencyCode stockLevel options{code name}assets{preview source}}facetValues{name facet{name}}collections{name slug}featuredAsset{preview source}assets{preview source}}}}
```

### Vendure with Pagination

```graphql
{
  products(options: { take: 100, skip: 0 }) {
    items {
      id
      name
      # ... rest of fields
    }
    totalItems
  }
}
```

---

## Docker Compose Configuration

### Production

```yaml
services:
  mcip:
    image: mcip:latest
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
      - REDIS_HOST=redis
      - QDRANT_URL=http://qdrant:6333
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - SOURCE_URL=${SOURCE_URL}
      - STORE_PROVIDER=${STORE_PROVIDER:-VENDURE}
      - GRAPHQL_QUERY=${GRAPHQL_QUERY}
      - ADMIN_API_KEY=${ADMIN_API_KEY}
      - STOREFRONT_URL=${STOREFRONT_URL}
    depends_on:
      redis:
        condition: service_healthy
      qdrant:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 40s

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
    volumes:
      - qdrant_storage:/qdrant/storage
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "timeout 1 bash -c 'cat < /dev/null > /dev/tcp/127.0.0.1/6333'"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 20s

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  qdrant_storage:
```

### Development (with volume mounts)

```yaml
services:
  mcip:
    build: .
    volumes:
      - ./src:/app/src
      - ./node_modules:/app/node_modules
    command: npm run start:dev
    environment:
      - NODE_ENV=development
      # ... rest of env vars
```

---

## Qdrant Configuration

MCIP creates a `products` collection with:

| Setting | Value |
|---------|-------|
| Vector Size | 1536 |
| Distance | Cosine |
| Indexes | `price.amount` (float), `category` (keyword), `brand` (keyword) |

To customize, modify `QdrantProductRepository.onModuleInit()`.

---

## Validation

All config is validated on startup. Missing required values will cause:

```
[Nest] ERROR - Configuration validation failed
[Nest] ERROR - OPENAI_API_KEY must be set
```

---

## Secrets Management

### Using Docker Secrets

```yaml
services:
  mcip:
    secrets:
      - openai_api_key
      - admin_api_key
    environment:
      - OPENAI_API_KEY_FILE=/run/secrets/openai_api_key
      - ADMIN_API_KEY_FILE=/run/secrets/admin_api_key

secrets:
  openai_api_key:
    external: true
  admin_api_key:
    external: true
```

### Using Kubernetes Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mcip-secrets
type: Opaque
stringData:
  OPENAI_API_KEY: sk-proj-xxx
  ADMIN_API_KEY: super-secret
---
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: mcip
          envFrom:
            - secretRef:
                name: mcip-secrets
```

---

## Performance Tuning

### BullMQ Concurrency

By default, the processor handles one job at a time. To increase:

```typescript
// ingestion.processor.ts
@Processor("product-ingestion", { concurrency: 5 })
```

### Qdrant Performance

For large datasets (100K+ products):

```yaml
# qdrant config
services:
  qdrant:
    environment:
      - QDRANT__SERVICE__GRPC_PORT=6334
      - QDRANT__STORAGE__PERFORMANCE__SEGMENT_LOAD_WORKERS=4
```

### OpenAI Rate Limits

For Tier 1 accounts, add delays:

```typescript
// Add to vectorization service
await new Promise(resolve => setTimeout(resolve, 100)); // 100ms between requests
```
