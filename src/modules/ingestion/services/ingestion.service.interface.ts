import { ImportProductsResponseDto } from "../dto/import-products-response.dto";
import { ImportProductsRequestDto } from "../dto/import-products-request.dto";

export interface IIngestionService {
	importProducts(request: ImportProductsRequestDto): Promise<ImportProductsResponseDto>;
	syncFromConfig(): Promise<ImportProductsResponseDto>;
}
