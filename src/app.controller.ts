import { Body, Controller, Post } from "@nestjs/common";
import { AppService } from "./app.service";
import { AiProcessingService } from "./core/services/ai-processing.service";
import { QdrantService } from "./core/services/qdrant.service";

@Controller()
export class AppController {
	constructor(
		private readonly appService: AppService,
		private readonly aiService: AiProcessingService,
		private readonly qdrantService: QdrantService
	) {}

	@Post("ingest-test")
	async testIngest(@Body() rawData: any) {
		// 1. Clean & Vectorize
		const processed = await this.aiService.processRawProduct(rawData);

		// 2. Save
		await this.qdrantService.upsertProduct(processed.payload, processed.vector);

		return { status: "success", id: processed.payload.externalId };
	}
}
