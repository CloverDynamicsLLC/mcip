import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Inject, Logger } from "@nestjs/common";
import { AiProcessingService } from "../core/services/ai-processing.service";
import { QdrantService } from "../core/services/qdrant.service";
import type { ProductMapper } from "./mapper/product-mapper.interface";
import { PRODUCT_MAPPER } from "../constants/tokens";

@Processor("product-ingestion")
class IngestionProcessor extends WorkerHost {
	private readonly logger = new Logger(IngestionProcessor.name);

	constructor(
		@Inject(PRODUCT_MAPPER) private readonly productMapper: ProductMapper,
		private readonly aiService: AiProcessingService,
		private readonly qdrantService: QdrantService
	) {
		super();
	}

	/**
	 * This method is called automatically when a job enters the queue.
	 */
	async process(job: Job<any, any, string>): Promise<any> {
		const rawProduct = job.data;
		this.logger.log(`[Job ${job.id}] Starting processing for product...`);

		try {
			// 1. Normalization (LLM or Vendure strategy)
			const cleanProduct = await this.productMapper.map(rawProduct);

			this.logger.log(`[Job ${job.id}] Normalized product: \n${JSON.stringify(cleanProduct, null, 2)}`);

			// 2. Vectorization
			// const vector = await this.aiService.generateEmbedding(cleanProduct);

			// 3. Database Upsert (Takes ~50ms)
			// await this.qdrantService.upsertProduct(cleanProduct, vector);

			this.logger.log(`[Job ${job.id}] Successfully indexed: ${cleanProduct.title}`);
			return { success: true, id: cleanProduct.externalId };
		} catch (error) {
			this.logger.error(`[Job ${job.id}] FAILED: ${error.message}`);
			// Throwing error tells BullMQ to retry (if configured) or move to "failed" list
			throw error;
		}
	}
}

export default IngestionProcessor;
