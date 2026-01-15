import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { BullModule } from "@nestjs/bullmq";
import { IngestionModule } from "./modules/ingestion/ingestion.module";
import { RepositoryModule } from "./modules/repository/repository.module";
import { VectorizationModule } from "./modules/vectorization/vectorization.module";
import { SearchModule } from "./modules/search/search.module";
import { AdminModule } from "./modules/admin/admin.module";
import { McpServerModule } from "./modules/mcp-server/mcp-server.module";
import { HardFilteringModule } from "./modules/hard-filtering/hard-filtering.module";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		BullModule.forRoot({
			connection: {
				host: process.env.REDIS_HOST || "localhost",
				port: Number(process.env.REDIS_PORT ?? 6379),
			},
		}),
		IngestionModule,
		RepositoryModule,
		VectorizationModule,
		VectorizationModule,
		SearchModule,
		AdminModule,
		McpServerModule,
		HardFilteringModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
