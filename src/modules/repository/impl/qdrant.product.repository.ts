import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { QdrantClient } from "@qdrant/js-client-rest";
import { ConfigService } from "@nestjs/config";
import { ProductRepository, SearchResult } from "../interfaces/product.repository.interface";
import { UnifiedProduct } from "../../../domain/product.schema";
import { generateId } from "../utils/id-generator";

@Injectable()
export class QdrantProductRepository implements ProductRepository, OnModuleInit {
	private readonly logger = new Logger(QdrantProductRepository.name);

	private client: QdrantClient;
	private readonly COLLECTION_NAME = "products";

	constructor(private configService: ConfigService) {
		this.client = new QdrantClient({
			url: this.configService.get<string>("QDRANT_URL"),
		});
	}

	/**
	 * Run on startup.
	 * Checks if the 'products' collection exists. If not, creates it.
	 */
	async onModuleInit() {
		const retries = 10;
		const delay = 3000;

		for (let i = 0; i < retries; i++) {
			try {
				const result = await this.client.getCollections();
				const exists = result.collections.some((c) => c.name === this.COLLECTION_NAME);

				if (!exists) {
					this.logger.log(`Creating collection '${this.COLLECTION_NAME}'...`);
					await this.client.createCollection(this.COLLECTION_NAME, {
						vectors: {
							size: 1536, // Matches OpenAI 'text-embedding-3-small' dimension
							distance: "Cosine",
						},
					});

					// OPTIONAL: Create Payload Indexes for fast filtering (filtering by price, brand, etc.)
					await this.client.createPayloadIndex(this.COLLECTION_NAME, {
						field_name: "price.amount",
						field_schema: "float",
					});
					await this.client.createPayloadIndex(this.COLLECTION_NAME, {
						field_name: "category",
						field_schema: "keyword",
					});
				}
				return; // Success
			} catch (error) {
				this.logger.warn(`Failed to connect to Qdrant (attempt ${i + 1}/${retries}): ${error.message}`);
				if (i === retries - 1) {
					this.logger.error("Could not connect to Qdrant after multiple attempts.");
					throw error;
				}
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}
	}

	async save(product: UnifiedProduct, vector: number[]): Promise<void> {
		await this.client.upsert(this.COLLECTION_NAME, {
			wait: true,
			points: [
				{
					id: generateId(product.externalId),
					vector: vector,
					payload: product,
				},
			],
		});
		this.logger.log(`Indexed product: ${product.title}`);
	}

	async search(queryVector: number[], limit = 10, offset = 0): Promise<SearchResult[]> {
		const searchResult = await this.client.search(this.COLLECTION_NAME, {
			vector: queryVector,
			limit: limit,
			offset: offset,
			with_payload: true,
		});

		return searchResult.map((hit) => ({
			score: hit.score,
			product: hit.payload as unknown as UnifiedProduct,
		}));
	}

	async delete(id: string): Promise<void> {
		await this.client.delete(this.COLLECTION_NAME, {
			points: [id],
		});
	}
}

