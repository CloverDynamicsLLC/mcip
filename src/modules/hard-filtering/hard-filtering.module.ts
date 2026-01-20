import { Module } from "@nestjs/common";
import { HardFilteringService } from "./hard-filtering.service";
import { ChatOpenAI } from "@langchain/openai";
import { RepositoryModule } from "../repository/repository.module";
import { VectorizationModule } from "../vectorization/vectorization.module";
import { LLM_MODEL } from "../../constants/tokens";
import { HardFilteringController } from "./hard-filtering.controller";

@Module({
	imports: [RepositoryModule, VectorizationModule],
	providers: [
		HardFilteringService,
		{
			provide: LLM_MODEL,
			useFactory: () => new ChatOpenAI({ model: "gpt-4o", temperature: 0 }),
		},
	],
	exports: [HardFilteringService, LLM_MODEL],
	controllers: [HardFilteringController],
})
export class HardFilteringModule {}
