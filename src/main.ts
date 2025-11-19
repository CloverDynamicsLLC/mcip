import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger } from '@nestjs/common';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	await app.listen(process.env.PORT ?? 8080);
  Logger.log(`Server is running on port ${process.env.PORT ?? 8080}`);
}
bootstrap();
