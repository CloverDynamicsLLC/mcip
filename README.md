# Molfar Agent

A NestJS-based agent for ingesting, normalizing, and searching product data using AI and Vector Search.

## Features

- **AI Processing**: Normalizes raw product data and generates embeddings using OpenAI.
- **Vector Search**: Fast and semantic search capabilities powered by Qdrant.
- **Asynchronous Ingestion**: robust queue management with BullMQ and Redis.

## Prerequisites

- Node.js (v18+)
- Docker & Docker Compose

## Installation & Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Infrastructure** (Redis & Qdrant)
   ```bash
   docker-compose up -d
   ```

3. **Configure Environment**
   Create a `.env` file in the root directory:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   QDRANT_URL=http://localhost:6333
   REDIS_HOST=localhost
   PORT=8080
   ```

4. **Run Application**
   ```bash
   npm run start:dev
   ```

The API will be available at `http://localhost:8080`.

## Store Manager Guide

To import products from an external source (e.g., a supplier's JSON feed), use the `/ingest/trigger-url` endpoint.

**Endpoint:** `POST /ingest/trigger-url`

**Parameters:**
- `url` (required): The direct link to the product JSON data.
- `token` (optional): Bearer token if the external API requires authentication.

**Example Usage (cURL):**

```bash
curl -X POST http://localhost:8080/ingest/trigger-url \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://supplier.com/api/products.json",
    "token": "optional_secret_token"
  }'
```

**Response:**
The system will queue the products for processing and return the number of items found.
