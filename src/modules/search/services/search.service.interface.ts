import { SearchResult } from "../../repository/interfaces/product.repository.interface";

export interface SearchService {
	search(SearchRequestDto): Promise<SearchResult[]>;
}
