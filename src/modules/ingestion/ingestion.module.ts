import { Logger, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { IngestionController } from "./ingestion.controller";
import IngestionProcessor from "./ingestion.processor";
import { CustomAiMapper } from "./mapper/strategies/custom-ai.mapper";
import { VendureMapper } from "./mapper/strategies/vendure.mapper";
import { INGESTION_SERVICE, PRODUCT_MAPPER } from "../../constants/tokens";
import { RepositoryModule } from "../repository/repository.module";
import { VectorizationModule } from "../vectorization/vectorization.module";
import { IngestionServiceImpl } from "./services/impl/ingestion.service";

@Module({
	imports: [
		BullModule.registerQueue({
			name: "product-ingestion",
		}),
		RepositoryModule,
		VectorizationModule,
	],
	controllers: [IngestionController],
	providers: [
		{
			provide: INGESTION_SERVICE,
			useClass: IngestionServiceImpl,
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
		CustomAiMapper,
		VendureMapper,
	],
	exports: [INGESTION_SERVICE],
})
export class IngestionModule {}
