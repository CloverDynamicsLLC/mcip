import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AdminController } from "./admin.controller";
import { IngestionModule } from "../ingestion/ingestion.module";

@Module({
	imports: [ConfigModule, IngestionModule],
	controllers: [AdminController],
})
export class AdminModule {}
