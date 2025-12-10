import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AdminController } from "./admin.controller";
import { IngestionModule } from "../ingestion/ingestion.module";
import { RepositoryModule } from "../repository/repository.module";

@Module({
	imports: [ConfigModule, IngestionModule, RepositoryModule],
	controllers: [AdminController],
})
export class AdminModule {}
