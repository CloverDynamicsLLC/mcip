# Getting Started

This guide walks you through building, deploying, and running MCIP (Machine Customer Interaction Protocol) from scratch.

## Prerequisites

- **Node.js** 20+ (for local development)
- **Docker** & **Docker Compose** (for deployment)
- **OpenAI API Key** (for embeddings and AI features)

## Installation Options

### Option 1: Docker Compose (Recommended)

This is the simplest way to run MCIP in production.

#### 1. Create project directory

```bash
mkdir mcip && cd mcip
```

#### 2. Create `docker-compose.yml`

```yaml
services:
  mcip:
    image: mcip:latest  # or your registry path
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
      - ADMIN_API_KEY=${ADMIN_API_KEY:-secret-admin-key}
    depends_on:
      redis:
        condition: service_healthy
      qdrant:
        condition: service_healthy
    restart: unless-stopped

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

#### 3. Create `.env` file

```env
OPENAI_API_KEY=sk-your-openai-key
SOURCE_URL=https://demo.vendure.io/shop-api
STORE_PROVIDER=VENDURE
GRAPHQL_QUERY={products{items{id name slug description variants{id sku name price priceWithTax currencyCode stockLevel}facetValues{name facet{name}}collections{name slug}featuredAsset{preview source}}}}
ADMIN_API_KEY=your-secret-key
```

#### 4. Start services

```bash
docker-compose up -d
```

#### 5. Verify health

```bash
curl http://localhost:8080/health
# Expected: {"status":"ok"}
```

---

### Option 2: Build from Source

For development or custom builds.

#### 1. Clone repository

```bash
git clone https://github.com/your-org/mcip.git
cd mcip
```

#### 2. Install dependencies

```bash
npm install
```

#### 3. Start infrastructure (Redis + Qdrant)

```bash
docker-compose up redis qdrant -d
```

#### 4. Configure environment

Create `.env` file in project root:

```env
OPENAI_API_KEY=sk-your-openai-key
SOURCE_URL=https://demo.vendure.io/shop-api
STORE_PROVIDER=VENDURE
REDIS_HOST=localhost
QDRANT_URL=http://localhost:6333
ADMIN_API_KEY=dev-admin-key
```

#### 5. Run in development mode

```bash
npm run start:dev
```

The server will start with hot-reload on `http://localhost:8080`.

---

### Option 3: Build Docker Image Locally

#### 1. Build the image

```bash
docker build -t mcip:latest .
```

The Dockerfile uses multi-stage build:
- **Stage 1**: Builds the TypeScript code
- **Stage 2**: Creates minimal production image

#### 2. Run with Docker Compose

```bash
docker-compose up -d
```

---

## Building for Production

### Compile TypeScript

```bash
npm run build
```

This outputs to `dist/` directory.

### Run production build

```bash
npm run start:prod
# or directly:
node dist/main.js
```

---

## Initial Setup After Deployment

### 1. Verify services are running

```bash
# Check health
curl http://localhost:8080/health

# Check Qdrant
curl http://localhost:6333/collections
```

### 2. Sync products from your store

```bash
curl -X POST http://localhost:8080/admin/sync \
  -H "x-admin-api-key: your-secret-key"
```

This will:
1. Fetch products from `SOURCE_URL`
2. Map them through the configured adapter (Vendure/Custom)
3. Generate embeddings via OpenAI
4. Store in Qdrant vector database

### 3. Test search

```bash
curl "http://localhost:8080/search?q=laptop"
```

---

## Production Checklist

- [ ] **OpenAI API Key** — Set `OPENAI_API_KEY`
- [ ] **Admin Key** — Change `ADMIN_API_KEY` from default
- [ ] **Data Source** — Configure `SOURCE_URL` and `GRAPHQL_QUERY`
- [ ] **Persistence** — Qdrant volume is mounted (`qdrant_storage`)
- [ ] **Monitoring** — Health endpoint at `/health`
- [ ] **Logging** — NestJS logs to stdout (capture with Docker/K8s)

---

## Troubleshooting

### "Cannot connect to Qdrant"

MCIP retries Qdrant connection 10 times on startup. Check:
```bash
docker-compose logs qdrant
```

### "OpenAI API error"

Verify your API key:
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### "No products found after sync"

1. Check sync response for errors
2. Verify `GRAPHQL_QUERY` returns products
3. Check ingestion queue logs:
   ```bash
   docker-compose logs mcip
   ```

### Queue jobs stuck

Redis might need restart:
```bash
docker-compose restart redis
```

---

## Next Steps

- [Architecture Overview](./architecture.md) — Understand how the system works
- [Custom Adapters](./custom-adapters.md) — Connect to your data source
- [API Reference](./api-reference.md) — All available endpoints
