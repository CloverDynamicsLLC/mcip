import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Inject, Logger } from "@nestjs/common";
import { PRODUCT_MAPPER, PRODUCT_REPOSITORY, VECTORIZATION_SERVICE } from "../../constants/tokens";
import type { ProductMapper } from "./mapper/product-mapper.interface";
import type { VectorizationService } from "../vectorization/services/vectorization.service.interface";
import type { ProductRepository } from "../repository/interfaces/product.repository.interface";

@Processor("product-ingestion")
class IngestionProcessor extends WorkerHost {
	private readonly logger = new Logger(IngestionProcessor.name);

	constructor(
		@Inject(PRODUCT_MAPPER) private readonly productMapper: ProductMapper,
		@Inject(PRODUCT_REPOSITORY) private readonly productRepository: ProductRepository,
		@Inject(VECTORIZATION_SERVICE) private readonly vectorizationService: VectorizationService
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
			// 1. Normalization
			const cleanedProduct = await this.productMapper.map(rawProduct);

			// 2. Vectorization
			const vector = await this.vectorizationService.embedProduct(cleanedProduct);

			// 3. Database Saving
			await this.productRepository.save(cleanedProduct, vector);

			this.logger.log(`[Job ${job.id}] Successfully indexed: ${cleanedProduct.title}`);
			return { success: true, id: cleanedProduct.externalId };
		} catch (error) {
			this.logger.error(`[Job ${job.id}] FAILED: ${error.message}`);
			// Throwing error tells BullMQ to retry (if configured) or move to "failed" list
			throw error;
		}
	}
}

export default IngestionProcessor;
