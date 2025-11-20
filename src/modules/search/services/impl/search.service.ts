import { Inject, Injectable } from "@nestjs/common";
import { type ProductRepository, SearchResult } from "src/modules/repository/interfaces/product.repository.interface";
import { SearchService } from "../search.service.interface";
import { PRODUCT_REPOSITORY, VECTORIZATION_SERVICE } from "../../../../constants/tokens";
import type { VectorizationService } from "../../../vectorization/services/vectorization.service.interface";
import { SearchRequestDto } from "../../dto/search-request.dto";

@Injectable()
export class SearchServiceImpl implements SearchService {
	constructor(
		@Inject(PRODUCT_REPOSITORY) private readonly productRepository: ProductRepository,
		@Inject(VECTORIZATION_SERVICE) private readonly vectorizationService: VectorizationService
	) {}

	async search({ q, take, skip }: SearchRequestDto): Promise<SearchResult[]> {
		// TODO: Implement Search Logic Here

		let queryVector: number[] = [];
		if (q) {
			queryVector = await this.vectorizationService.embedString(q);
		}

		const filterPayload: any = {};

		return await this.productRepository.search(
			queryVector,
			Object.keys(filterPayload).length > 0 ? filterPayload : undefined,
			take,
			skip
		);
	}
}
