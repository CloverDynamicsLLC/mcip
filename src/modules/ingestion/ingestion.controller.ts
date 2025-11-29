import { Body, Controller, Inject, Post } from "@nestjs/common";
import { ImportProductsRequestDto } from "./dto/import-products-request.dto";
import { INGESTION_SERVICE } from "../../constants/tokens";
import type { IngestionService } from "./services/ingestion.service.interface";

@Controller("ingest")
export class IngestionController {
	constructor(@Inject(INGESTION_SERVICE) private readonly ingestionService: IngestionService) {}

	@Post("import-products")
	async importProducts(@Body() body: ImportProductsRequestDto) {
		return this.ingestionService.importProducts(body);
	}
}
