import { Body, Controller, Inject, Post } from "@nestjs/common";
import type { IIngestionService } from "./services/ingestion.service.interface";
import { ImportProductsRequestDto } from "./dto/import-products-request.dto";
import { INGESTION_SERVICE } from "../constants/tokens";

@Controller("ingest")
export class IngestionController {
	constructor(@Inject(INGESTION_SERVICE) private readonly ingestionService: IIngestionService) {}

	@Post("import-products")
	async importProducts(@Body() body: ImportProductsRequestDto) {
		return this.ingestionService.importProducts(body);
	}
}
