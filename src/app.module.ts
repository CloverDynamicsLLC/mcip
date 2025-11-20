import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AiProcessingService } from "./core/services/ai-processing.service";
import { BullModule } from "@nestjs/bullmq";
import { IngestionModule } from "./modules/ingestion/ingestion.module";
import { SearchController } from './api/search.controller';
import { RepositoryModule } from "./modules/repository/repository.module";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		BullModule.forRoot({
			connection: {
				host: process.env.REDIS_HOST || "localhost",
				port: 6379,
			},
		}),
		IngestionModule,
		RepositoryModule,
	],
	controllers: [AppController, SearchController],
	providers: [AppService, AiProcessingService],
})
export class AppModule {}
