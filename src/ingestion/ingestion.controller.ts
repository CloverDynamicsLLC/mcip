import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

@Controller("ingest")
export class IngestionController {
	constructor(@InjectQueue("product-ingestion") private ingestionQueue: Queue) {}

	/**
	 * Endpoint: POST /ingest
	 * Accepts an array of raw products.
	 */
	@Post()
	@HttpCode(HttpStatus.ACCEPTED) // Return 202 Accepted (standard for async ops)
	async ingestProducts(@Body() products: any[]) {
		if (!Array.isArray(products)) {
			// Handle a single object case just in case
			products = [products];
		}

		// Create a job for each product
		const jobs = products.map((product) => ({
			name: "process-product",
			data: product,
			opts: {
				attempts: 3, // Retry 3 times if AI fails (e.g. rate limit)
				backoff: {
					type: "exponential",
					delay: 2000, // Wait 2s, then 4s, then 8s
				},
				removeOnComplete: true, // Don't clutter Redis with successful jobs
			},
		}));

		await this.ingestionQueue.addBulk(jobs);

		return {
			status: "queued",
			count: jobs.length,
			message: "Processing started in background",
		};
	}
}
