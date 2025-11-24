# MCIP (Machine Customer Interaction Protocol)

A NestJS-based agent for customer interaction using AI and Vector Search. Designed to be easily deployed as a Docker container plugin.

## Features

- **AI Processing**: Normalizes raw product data and generates embeddings using OpenAI.
- **Vector Search**: Fast and semantic search capabilities powered by Qdrant.
- **Asynchronous Ingestion**: Robust queue management with BullMQ and Redis.
- **Admin Sync**: Secure, configuration-driven product synchronization.

## Deployment

### Prerequisites

- Docker & Docker Compose

### Quick Start

1. **Clone the repository** (or download `docker-compose.yml`)
2. **Configure Environment**
   Create a `.env` file or modify `docker-compose.yml` with your settings:

    ```env
    # Required
    OPENAI_API_KEY=sk-your-api-key
    SOURCE_URL=https://your-store.com/api/products
    ADMIN_API_KEY=your-secret-admin-key

    # Optional
    SOURCE_STRATEGY=VENDURE  # Options: VENDURE, OPENAPI (Default: VENDURE)
    GRAPHQL_QUERY=...        # Minimized GraphQL query string (if using GraphQL)
    PORT=8080                # Default: 8080
    ```

3. **Run with Docker Compose**
    ```bash
    docker-compose up -d
    ```

The API will be available at `http://localhost:8080`.

## Configuration

| Variable          | Description                    | Default                            |
| ----------------- | ------------------------------ | ---------------------------------- |
| `OPENAI_API_KEY`  | Your OpenAI API Key            | **Required**                       |
| `SOURCE_URL`      | URL to fetch products from     | `https://demo.vendure.io/shop-api` |
| `SOURCE_STRATEGY` | Ingestion strategy             | `VENDURE`                          |
| `ADMIN_API_KEY`   | Secret key for admin endpoints | `secret-admin-key`                 |
| `GRAPHQL_QUERY`   | GraphQL query string           | (Empty)                            |
| `PORT`            | Application port               | `8080`                             |
| `REDIS_HOST`      | Redis hostname                 | `redis`                            |
| `QDRANT_URL`      | Qdrant URL                     | `http://qdrant:6333`               |

## Usage

### Admin Sync

Trigger a product synchronization from the configured source.

**Endpoint:** `POST /admin/sync`
**Headers:** `x-admin-api-key: <ADMIN_API_KEY>`

**Example:**

```bash
curl -X POST http://localhost:8080/admin/sync \
  -H "x-admin-api-key: your-secret-admin-key"
```

### Health Check

Check if the service is running.

**Endpoint:** `GET /health`

**Example:**

```bash
curl http://localhost:8080/health
```
