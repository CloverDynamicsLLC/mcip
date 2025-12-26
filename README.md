# MCIP — Machine Customer Interaction Protocol

> An AI-powered product search and discovery agent

A NestJS-based semantic search engine that enables natural language product discovery. Designed as a plug-and-play microservice that can connect to any e-commerce backend through configurable adapters.

## ✨ Features

- **AI-Powered Search** — Natural language queries with automatic filter extraction (brand, category, price range)
- **Semantic Vector Search** — Powered by Qdrant for fast similarity matching
- **Hybrid Filtering** — Combines vector search with hard filters (inclusion & exclusion)
- **Flexible Adapters** — Built-in Vendure support + AI-based fallback for any data source
- **Async Processing** — Robust queue-based ingestion with BullMQ and Redis
- **Production Ready** — Docker-first deployment with health checks and auto-recovery

## 🏗️ Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Your Store    │────▶│       MCIP       │────▶│     Qdrant      │
│   (Vendure/API) │     │    (NestJS)      │     │   (Vector DB)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌──────────────┐
                        │    Redis     │
                        │   (Queue)    │
                        └──────────────┘
```

**Data Flow:**
1. **Ingestion** — Products are fetched from your store via REST/GraphQL
2. **Normalization** — Raw data is mapped to a unified schema (via adapters)
3. **Vectorization** — OpenAI generates embeddings for semantic search
4. **Storage** — Products + vectors are stored in Qdrant
5. **Search** — User queries are vectorized and matched against products

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- OpenAI API Key

### 1. Clone & Configure

```bash
git clone https://github.com/your-org/mcip.git
cd mcip
```

Create a `.env` file:

```env
# Required
OPENAI_API_KEY=sk-your-api-key

# Data Source
SOURCE_URL=https://demo.vendure.io/shop-api
STORE_PROVIDER=VENDURE
GRAPHQL_QUERY={products{items{id name slug description variants{id sku name price priceWithTax currencyCode stockLevel}facetValues{name facet{name}}collections{name slug}featuredAsset{preview source}}}}

# Security
ADMIN_API_KEY=your-secret-admin-key

# Optional
PORT=8080
STOREFRONT_URL=https://your-store.com
```

### 2. Run with Docker Compose

```bash
docker-compose up -d
```

The API will be available at `http://localhost:8080`.

### 3. Sync Products

```bash
curl -X POST http://localhost:8080/admin/sync \
  -H "x-admin-api-key: your-secret-admin-key"
```

### 4. Search

```bash
# Simple search
curl "http://localhost:8080/search?q=gaming+laptop"

# Natural language with filters
curl "http://localhost:8080/search?q=nike+shoes+under+100"
```

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](./docs/getting-started.md) | Build, deploy, and run the server |
| [Architecture](./docs/architecture.md) | System design and module overview |
| [Custom Adapters](./docs/custom-adapters.md) | Create adapters for your data source |
| [API Reference](./docs/api-reference.md) | All available endpoints |
| [Configuration](./docs/configuration.md) | Environment variables and options |

## ⚙️ Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API Key for embeddings | **Required** |
| `SOURCE_URL` | URL to fetch products from | `https://demo.vendure.io/shop-api` |
| `STORE_PROVIDER` | Adapter to use (`VENDURE` or `CUSTOM`) | `VENDURE` |
| `GRAPHQL_QUERY` | GraphQL query for fetching products | — |
| `ADMIN_API_KEY` | Secret key for admin endpoints | `secret-admin-key` |
| `PORT` | Application port | `8080` |
| `REDIS_HOST` | Redis hostname | `redis` |
| `QDRANT_URL` | Qdrant URL | `http://qdrant:6333` |
| `STOREFRONT_URL` | Your store's public URL (for product links) | — |

## 🔌 API Endpoints

### Search

```
GET /search?q={query}&take={limit}&skip={offset}
```

Search products using natural language. Automatically extracts filters from queries like "Nike shoes under $100 but not running shoes".

### Admin

```
POST /admin/sync
Headers: x-admin-api-key: {ADMIN_API_KEY}
```

Trigger product synchronization from configured source.

```
POST /admin/recreate-indexes
Headers: x-admin-api-key: {ADMIN_API_KEY}
```

Rebuild Qdrant payload indexes.

### Health

```
GET /health
```

Returns service health status.

## 🔧 Development

### Local Development

```bash
# Install dependencies
npm install

# Start dependencies (Redis + Qdrant)
docker-compose up redis qdrant -d

# Run in development mode
npm run start:dev
```

### Build

```bash
npm run build
```

### Testing

```bash
npm run test
npm run test:e2e
```

## 🛠️ Tech Stack

- **Runtime**: Node.js 20 + NestJS 11
- **Vector Database**: Qdrant
- **Queue**: BullMQ + Redis
- **AI**: OpenAI (embeddings + structured output)
- **Validation**: Zod schemas

## 📄 License

UNLICENSED — Private project
