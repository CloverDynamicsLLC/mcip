import { Logger, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { QdrantService } from "../../core/services/qdrant.service";
import { AiProcessingService } from "../../core/services/ai-processing.service";
import { IngestionController } from "./ingestion.controller";
import IngestionProcessor from "./ingestion.processor";
import { IngestionService } from "./services/impl/ingestion.service";
import { CustomAiMapper } from "./mapper/strategies/custom-ai.mapper";
import { VendureMapper } from "./mapper/strategies/vendure.mapper";
import { INGESTION_SERVICE, PRODUCT_MAPPER } from "../../constants/tokens";

@Module({
	imports: [
		BullModule.registerQueue({
			name: "product-ingestion",
		}),
	],
	controllers: [IngestionController],
	providers: [
		{
			provide: INGESTION_SERVICE,
			useClass: IngestionService,
		},
		{
			provide: PRODUCT_MAPPER,
			useFactory: (cS: ConfigService, cAiM: CustomAiMapper, vM: VendureMapper) => {
				const storeProvider = cS.get<string>("STORE_PROVIDER", "VENDURE");
        Logger.log(`Using store provider: ${storeProvider}`);
				switch (storeProvider.toLowerCase()) {
					case "vendure":
						return vM;
					default:
						return cAiM;
				}
			},
			inject: [ConfigService, CustomAiMapper, VendureMapper],
		},
		IngestionProcessor,
		QdrantService,
		AiProcessingService,
		CustomAiMapper,
		VendureMapper,
	],
})
export class IngestionModule {}
