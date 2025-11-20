import { SearchResult } from "../../repository/interfaces/product.repository.interface";

export interface SearchService {
	search(query: string): Promise<SearchResult[]>;
}
