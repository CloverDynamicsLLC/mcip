import { Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { AdminGuard } from "./guards/admin.guard";
import { INGESTION_SERVICE } from "../../constants/tokens";
import type { IngestionService } from "../ingestion/services/ingestion.service.interface";

@Controller("admin")
@UseGuards(AdminGuard)
export class AdminController {
	constructor(@Inject(INGESTION_SERVICE) private readonly ingestionService: IngestionService) {}

	@Post("sync")
	async sync() {
		return this.ingestionService.syncFromConfig();
	}
}
