import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AdminGuard implements CanActivate {
	constructor(private configService: ConfigService) {}

	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest();
		const apiKey = request.headers["x-admin-api-key"];
		const validApiKey = this.configService.get<string>("ADMIN_API_KEY");

		if (!validApiKey) {
			// If no key is configured, block all admin access for security
			return false;
		}

		if (apiKey !== validApiKey) {
			throw new UnauthorizedException("Invalid Admin API Key");
		}

		return true;
	}
}
