import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SearchController } from "./search.controller";
import { SearchServiceImpl } from "./services/impl/search.service";
import { SEARCH_SERVICE } from "../../constants/tokens";
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
	],
})
export class SearchModule {}

