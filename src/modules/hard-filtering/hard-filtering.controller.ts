import { Controller, Get, Logger, Query } from "@nestjs/common";

@Controller()
export class HardFilteringController {
	private readonly logger = new Logger(HardFilteringController.name);

	@Get("agentic-search")
	agenticSearch(@Query("query") query: string) {
		this.logger.log(`Query: ${query}`);

		throw new Error("Not implemented");
	}
}
