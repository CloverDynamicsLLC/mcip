import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Logger } from "@nestjs/common";
import { AiProcessingService } from "../core/services/ai-processing.service";
import { QdrantService } from "../core/services/qdrant.service";

@Processor("product-ingestion") // Must match the name in AppModule
export class IngestionProcessor extends WorkerHost {
	private readonly logger = new Logger(IngestionProcessor.name);

	constructor(
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
			// 1. AI Normalization & Vectorization (Takes ~1-2s)
			const processed = await this.aiService.processRawProduct(rawProduct);

			// 2. Database Upsert (Takes ~50ms)
			await this.qdrantService.upsertProduct(processed.payload, processed.vector);

			this.logger.log(`[Job ${job.id}] Successfully indexed: ${processed.payload.title}`);
			return { success: true, id: processed.payload.externalId };
		} catch (error) {
			this.logger.error(`[Job ${job.id}] FAILED: ${error.message}`);
			// Throwing error tells BullMQ to retry (if configured) or move to "failed" list
			throw error;
		}
	}
}
