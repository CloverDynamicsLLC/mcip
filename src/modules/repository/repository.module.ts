import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { QdrantProductRepository } from "./impl/qdrant.product.repository";
import { PRODUCT_REPOSITORY } from "../../constants/tokens";

@Module({
	imports: [ConfigModule],
	providers: [
		{
			provide: PRODUCT_REPOSITORY,
			useClass: QdrantProductRepository,
		},
	],
	exports: [PRODUCT_REPOSITORY],
})
export class RepositoryModule {}





