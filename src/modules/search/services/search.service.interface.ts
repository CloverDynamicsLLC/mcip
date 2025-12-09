import { SearchRequestDto } from "../dto/search-request.dto";
import { SearchServiceResult } from "../interfaces/search-service-result.interface";

export interface SearchService {
	search(request: SearchRequestDto): Promise<SearchServiceResult>;
}
