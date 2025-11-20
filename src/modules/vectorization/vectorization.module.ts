import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { OpenAiVectorizationService } from "./services/impl/openai.vectorization.service";
import { VECTORIZATION_SERVICE } from "../../constants/tokens";

@Module({
	imports: [ConfigModule],
	providers: [
		{
			provide: VECTORIZATION_SERVICE,
			useClass: OpenAiVectorizationService,
		},
	],
	exports: [VECTORIZATION_SERVICE],
})
export class VectorizationModule {}

