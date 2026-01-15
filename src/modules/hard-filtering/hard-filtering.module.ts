import { Module } from "@nestjs/common";
import { HardFilteringService } from "./hard-filtering.service";
import { ChatOpenAI } from "@langchain/openai";

@Module({
	providers: [
		HardFilteringService,
		{
			provide: "CHAT_MODEL",
			useFactory: () => {
				return new ChatOpenAI({
					model: "gpt-4o",
					temperature: 0,
				});
			},
		},
	],
	exports: [HardFilteringService, "CHAT_MODEL"],
})
export class HardFilteringModule {}
