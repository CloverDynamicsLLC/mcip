import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { BullModule } from "@nestjs/bullmq";
import { IngestionModule } from "./modules/ingestion/ingestion.module";
import { SearchController } from './modules/search/search.controller';
import { RepositoryModule } from "./modules/repository/repository.module";
import { VectorizationModule } from "./modules/vectorization/vectorization.module";
import { SearchModule } from './modules/search/search.module';

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
		VectorizationModule,
    SearchModule
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
