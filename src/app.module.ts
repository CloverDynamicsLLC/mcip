import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { QdrantService } from "./core/services/qdrant.service";
import { AiProcessingService } from "./core/services/ai-processing.service";

@Module({
	imports: [ConfigModule.forRoot({ isGlobal: true })],
	controllers: [AppController],
	providers: [AppService, AiProcessingService, QdrantService],
})
export class AppModule {}
