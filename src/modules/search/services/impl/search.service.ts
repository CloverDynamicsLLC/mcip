import { Inject, Injectable } from "@nestjs/common";
import { type ProductRepository, SearchResult } from "src/modules/repository/interfaces/product.repository.interface";
import { SearchService } from "../search.service.interface";
import { PRODUCT_REPOSITORY, VECTORIZATION_SERVICE } from '../../../../constants/tokens';
import type { VectorizationService } from '../../../vectorization/services/vectorization.service.interface';

@Injectable()
export class SearchServiceImpl implements SearchService {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly productRepository: ProductRepository,
    @Inject(VECTORIZATION_SERVICE) private readonly vectorizationService: VectorizationService
  ) {}

	async search(query: string): Promise<SearchResult[]> {
    // TODO: Implement Search Logic


    // 1. Generate Vector from User Query
    // If query is empty (browsing mode), we might skip this or use a "dummy" vector
    let queryVector: number[] = [];
    if (query) {
      queryVector = await this.vectorizationService.embedString(query);
    }

    // 2. Build Filters (Qdrant Syntax)
    // This allows us to drill down: "Shoes" (Vector) + "Category: Men" (Filter)
    const filterPayload: any = {};
    // if (category) {
    //   filterPayload.must = [
    //     {
    //       key: "category",
    //       match: { value: category },
    //     },
    //   ];
    // }

    // 3. Execute Search
    // Note: If query is empty, Qdrant's 'scroll' API is better, but 'search' needs a vector.
    // For this MVP, we assume query is present.
    return await this.productRepository.search(
      queryVector,
      Object.keys(filterPayload).length > 0 ? filterPayload : undefined,
      parseInt("5")
    );

	}
}
