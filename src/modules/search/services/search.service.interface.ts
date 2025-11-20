import { SearchResult } from "../../repository/interfaces/product.repository.interface";
import { SearchRequestDto } from "../dto/search-request.dto";

export interface SearchService {
	search(request: SearchRequestDto): Promise<SearchResult[]>;
}
