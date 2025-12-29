import { Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { AdminGuard } from "./guards/admin.guard";
import { INGESTION_SERVICE, PRODUCT_REPOSITORY } from "../../constants/tokens";
import type { IngestionService } from "../ingestion/services/ingestion.service.interface";
import type { ProductRepository } from "../repository/interfaces/product.repository.interface";

@Controller("admin")
@UseGuards(AdminGuard)
export class AdminController {
	constructor(
		@Inject(INGESTION_SERVICE) private readonly ingestionService: IngestionService,
		@Inject(PRODUCT_REPOSITORY) private readonly productRepository: ProductRepository
	) {}

	@Post("sync")
	async sync() {
		return this.ingestionService.syncFromConfig();
	}

	@Post("recreate-indexes")
	async recreateIndexes() {
		await this.productRepository.recreateIndexes();
		return { message: "Indexes recreated successfully" };
	}
}
