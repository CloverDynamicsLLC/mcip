import { Controller, Post, UseGuards, Inject } from "@nestjs/common";
import { AdminGuard } from "./guards/admin.guard";
import { INGESTION_SERVICE } from "../../constants/tokens";
import type { IIngestionService } from "../ingestion/services/ingestion.service.interface";

@Controller("admin")
@UseGuards(AdminGuard)
export class AdminController {
	constructor(@Inject(INGESTION_SERVICE) private readonly ingestionService: IIngestionService) {}

	@Post("sync")
	async sync() {
		return this.ingestionService.syncFromConfig();
	}
}
