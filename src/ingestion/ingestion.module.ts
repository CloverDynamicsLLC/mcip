import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { QdrantService } from "../core/services/qdrant.service";
import { AiProcessingService } from "../core/services/ai-processing.service";
import { IngestionController } from "./ingestion.controller";
import { IngestionProcessor } from "./ingestion.processor";
import { UrlImportService } from "./url-import.service";

@Module({
	imports: [
		BullModule.registerQueue({
			name: "product-ingestion",
		}),
	],
	controllers: [IngestionController],
	providers: [IngestionProcessor, QdrantService, AiProcessingService, UrlImportService],
})
export class IngestionModule { }
