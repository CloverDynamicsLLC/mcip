import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { QdrantClient } from "@qdrant/js-client-rest";
import { ConfigService } from "@nestjs/config";
import { ProductRepository, SearchFilters, SearchResult } from "../interfaces/product.repository.interface";
import { UnifiedProduct } from "../../../domain/product.schema";
import { generateId } from "../utils/id-generator";

@Injectable()
export class QdrantProductRepository implements ProductRepository, OnModuleInit {
	private readonly logger = new Logger(QdrantProductRepository.name);

	private readonly client: QdrantClient;
	private readonly COLLECTION_NAME = "products";

	constructor(private readonly configService: ConfigService) {
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
				await this.ensureCollectionExists();
				await this.ensureIndexes();

				this.logger.log("Collection initialization complete");
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

	async hybridSearch(queryVector: number[], filters: SearchFilters, limit = 10, offset = 0): Promise<SearchResult[]> {
		const must: any[] = [];
		const must_not: any[] = [];

		// Brand INCLUSION filter (exact match)
		if (filters.brand?.length) {
			must.push({ key: "brand", match: { any: filters.brand } });
		}

		// Brand EXCLUSION filter
		if (filters.excludeBrand?.length) {
			must_not.push({ key: "brand", match: { any: filters.excludeBrand } });
		}

		// Category INCLUSION filter (exact match)
		if (filters.category?.length) {
			must.push({ key: "category", match: { any: filters.category } });
		}

		// Category EXCLUSION filter
		if (filters.excludeCategory?.length) {
			must_not.push({ key: "category", match: { any: filters.excludeCategory } });
		}

		// Price range filter
		if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
			must.push({
				key: "price.amount",
				range: {
					...(filters.priceMin !== undefined && { gte: filters.priceMin }),
					...(filters.priceMax !== undefined && { lte: filters.priceMax }),
				},
			});
		}

		// Attribute filters (nested array filtering)
		if (filters.attributes?.length) {
			for (const attr of filters.attributes) {
				must.push({
					nested: {
						key: "attributes",
						filter: {
							must: [
								{ key: "attributes[].name", match: { value: attr.name } },
								{ key: "attributes[].value", match: { any: attr.values } },
							],
						},
					},
				});
			}
		}

		// Build filter object with must and must_not conditions
		const filter: any = {};
		if (must.length > 0) filter.must = must;
		if (must_not.length > 0) filter.must_not = must_not;

		const searchResult = await this.client.search(this.COLLECTION_NAME, {
			vector: queryVector,
			limit,
			offset,
			with_payload: true,
			filter: Object.keys(filter).length > 0 ? filter : undefined,
		});

		return searchResult.map((hit) => ({
			score: hit.score,
			product: hit.payload as unknown as UnifiedProduct,
		}));
	}

	async getFacetValues(key: string, limit: number = 100): Promise<string[]> {
		const values = await this.client.facet(this.COLLECTION_NAME, { key, limit });
		return values.hits.map((h) => h.value as string);
	}

	async delete(id: string): Promise<void> {
		await this.client.delete(this.COLLECTION_NAME, {
			points: [id],
		});
	}

	/**
	 * Recreate all payload indexes.
	 * Useful for fixing missing indexes without recreating the entire collection.
	 */
	async recreateIndexes(): Promise<void> {
		this.logger.log("Recreating payload indexes...");

		const indexes = [
			{ field_name: "price.amount", field_schema: "float" as const },
			{ field_name: "category", field_schema: "keyword" as const },
			{ field_name: "brand", field_schema: "keyword" as const },
			{ field_name: "attributes[].name", field_schema: "keyword" as const },
			{ field_name: "attributes[].value", field_schema: "keyword" as const },
		];

		for (const index of indexes) {
			try {
				await this.client.createPayloadIndex(this.COLLECTION_NAME, index);
				this.logger.log(`✓ Index created: ${index.field_name} (${index.field_schema})`);
			} catch (error) {
				this.logger.warn(`Failed to create index ${index.field_name}: ${error.message}`);
			}
		}

		this.logger.log("Index recreation complete");
	}

	private async ensureCollectionExists() {
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
		}
	}

	private async ensureIndexes() {
		this.logger.log("Ensuring payload indexes exist...");

		const indexes = [
			{ field: "price.amount", schema: "float" },
			{ field: "category", schema: "keyword" },
			{ field: "brand", schema: "keyword" },
			{ field: "attributes[].name", schema: "keyword" },
			{ field: "attributes[].value", schema: "keyword" },
		];

		// Process all indexes sequentially or in parallel
		for (const idx of indexes) {
			try {
				await this.client.createPayloadIndex(this.COLLECTION_NAME, {
					field_name: idx.field,
					field_schema: idx.schema as any, // Cast if your Qdrant types are strict
				});
				this.logger.log(`✓ Index created/verified: ${idx.field} (${idx.schema})`);
			} catch (error) {
				// Index might already exist, which is fine
				this.logger.debug(`Index ${idx.field}: ${error.message}`);
			}
		}
	}
}
