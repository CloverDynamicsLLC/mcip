import { Module } from "@nestjs/common";
import { SearchController } from "./search.controller";
import { SearchServiceImpl } from "./services/impl/search.service";
import { FeatureExtractionServiceImpl } from "./services/impl/feature-extraction.service";
import { FEATURE_EXTRACTION_SERVICE, SEARCH_SERVICE } from "../../constants/tokens";
import { RepositoryModule } from "../repository/repository.module";
import { VectorizationModule } from "../vectorization/vectorization.module";

@Module({
	imports: [RepositoryModule, VectorizationModule],
	controllers: [SearchController],
	providers: [
		{
			provide: SEARCH_SERVICE,
			useClass: SearchServiceImpl,
		},
		{
			provide: FEATURE_EXTRACTION_SERVICE,
			useClass: FeatureExtractionServiceImpl,
		},
	],
	exports: [SEARCH_SERVICE],
})
export class SearchModule {}
