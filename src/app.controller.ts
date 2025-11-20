import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";

@Controller()
export class AppController {
	constructor(private readonly appService: AppService) {}

	@Get("hello")
	async getHello() {
		const hello = this.appService.getHello();
		return { status: "success", message: `Hello, mate! ${hello}` };
	}
}
