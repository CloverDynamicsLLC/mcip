import { Module } from "@nestjs/common";
import { SearchTool } from "./tools/search.tool";
import { McpModule, McpTransportType } from "@rekog/mcp-nest";
import { SearchModule } from "../search/search.module";

@Module({
	imports: [
		McpModule.forRoot({
			name: "mcip-mcp-server",
			version: "1.0.0",
			transport: McpTransportType.STREAMABLE_HTTP,
		}),
		SearchModule,
	],
	providers: [SearchTool],
})
export class McpServerModule {}
