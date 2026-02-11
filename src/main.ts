import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger, ValidationPipe } from "@nestjs/common";

void (async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	app.useGlobalPipes(new ValidationPipe({ transform: true }));
	await app.listen(process.env.PORT ?? 8080);
	Logger.log(`Server is running on port ${process.env.PORT ?? 8080}`);
})();
