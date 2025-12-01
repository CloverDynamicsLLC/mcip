import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SearchController } from "./search.controller";
import { SearchServiceImpl } from "./services/impl/search.service";
import { ProductFilterServiceImpl } from "./services/impl/product-filter.service";
import { PRODUCT_FILTER_SERVICE, SEARCH_SERVICE } from "../../constants/tokens";
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
			provide: PRODUCT_FILTER_SERVICE,
			useClass: ProductFilterServiceImpl,
		},
	],
})
export class SearchModule {}
