import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SearchController } from "./search.controller";
import { SearchServiceImpl } from "./services/impl/search.service";
import { FeatureExtractionServiceImpl } from "./services/impl/feature-extraction.service";
import { SEARCH_SERVICE, FEATURE_EXTRACTION_SERVICE } from "../../constants/tokens";
import { RepositoryModule } from "../repository/repository.module";
import { VectorizationModule } from "../vectorization/vectorization.module";

@Module({
	imports: [ConfigModule, RepositoryModule, VectorizationModule],
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
})
export class SearchModule {}

