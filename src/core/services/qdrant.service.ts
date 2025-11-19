import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { QdrantClient } from "@qdrant/js-client-rest";
import { UnifiedProduct } from "../domain/product.schema";
import { ConfigService } from "@nestjs/config";
import { generateId } from "../utils/id-generator";

@Injectable()
export class QdrantService implements OnModuleInit {
	private readonly logger = new Logger(QdrantService.name);

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
			// This makes "WHERE price < 100" very fast.
			await this.client.createPayloadIndex(this.COLLECTION_NAME, {
				field_name: "price.amount",
				field_schema: "float",
			});
			await this.client.createPayloadIndex(this.COLLECTION_NAME, {
				field_name: "category",
				field_schema: "keyword",
			});
		}
	}

	/**
	 * WRITE OPERATION
	 * Saves the cleaned product and its vector.
	 */
	async upsertProduct(product: UnifiedProduct, vector: number[]) {
		await this.client.upsert(this.COLLECTION_NAME, {
			wait: true,
			points: [
				{
					id: generateId(product.externalId),
					vector: vector,
					payload: product, // We store the whole JSON so we don't need a secondary DB
				},
			],
		});
		this.logger.log(`Indexed product: ${product.title}`);
	}

	/**
	 * READ OPERATION (Hybrid Search)
	 * Searches by vector similarity AND applies hard filters.
	 */
	async search(queryVector: number[], filter?: any, limit = 10) {
		const searchResult = await this.client.search(this.COLLECTION_NAME, {
			vector: queryVector,
			limit: limit,
			filter: filter, // Qdrant filter object (must be built before passing here)
			with_payload: true,
		});

		return searchResult.map((hit) => ({
			score: hit.score, // How relevant (0 to 1)
			product: hit.payload as unknown as UnifiedProduct,
		}));
	}

	/**
	 * DELETE OPERATION
	 * If a product is removed from the shop.
	 */
	async deleteProduct(id: string) {
		await this.client.delete(this.COLLECTION_NAME, {
			points: [id],
		});
	}
}
