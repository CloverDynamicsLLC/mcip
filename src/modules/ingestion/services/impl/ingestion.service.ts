import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import { ImportProductsRequestDto } from "src/modules/ingestion/dto/import-products-request.dto";
import { ImportProductsResponseDto } from "src/modules/ingestion/dto/import-products-response.dto";
import { IngestionService } from "../ingestion.service.interface";

@Injectable()
export class IngestionServiceImpl implements IngestionService {
	private readonly logger = new Logger(IngestionServiceImpl.name);

	constructor(
		@InjectQueue("product-ingestion") private ingestionQueue: Queue,
		private configService: ConfigService
	) {}

	async syncFromConfig(): Promise<ImportProductsResponseDto> {
		const url = this.configService.get<string>("SOURCE_URL");
		const apiKey = this.configService.get<string>("SOURCE_API_KEY"); // Optional
		const graphqlQuery = this.configService.get<string>("GRAPHQL_QUERY");

		if (!url) {
			throw new BadRequestException("SOURCE_URL environment variable is not set");
		}

		this.logger.log(`Starting sync from config: ${url}`);

		return this.importProducts({
			url,
			apiKey,
			graphqlQuery,
		});
	}

	async importProducts({ url, apiKey, graphqlQuery }: ImportProductsRequestDto): Promise<ImportProductsResponseDto> {
		this.logger.log(`Started importing from: ${url} ${graphqlQuery ? "(GraphQL)" : "(REST)"}`);

		try {
			let rawData: any;

			if (graphqlQuery) {
				// GraphQL Flow
				const cleanQuery = graphqlQuery.replace(/\\n/g, "\n");

				const response = await axios.post(
					url,
					{
						query: cleanQuery,
					},
					{
						headers: apiKey
							? { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }
							: { "Content-Type": "application/json" },
						timeout: 30000,
					}
				);

				// Check for GraphQL errors
				if (response.data.errors && response.data.errors.length > 0) {
					this.logger.warn(`GraphQL Errors reported: ${JSON.stringify(response.data.errors)}`);
				}

				// Standard GraphQL response has 'data' property
				if (response.data.data) {
					rawData = response.data.data;
				} else {
					// Fallback for non-standard or error-only responses
					rawData = response.data;
				}
			} else {
				// REST Flow
				const response = await axios.get(url, {
					headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
					timeout: 30000,
				});
				rawData = response.data;
			}

			const products = this.findArray(rawData);

			if (!products) {
				throw new BadRequestException(
					"API response does not contain an array of products or could not find one in the response"
				);
			}

			await this.processArray(products);

			return {
				status: "success",
				message: `Queued ${products.length} products from URL`,
				count: products.length,
			};
		} catch (error) {
			if (axios.isAxiosError(error)) {
				this.logger.error(`Import failed: ${error.message}`);
				if (error.response) {
					this.logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
				}
			} else {
				this.logger.error(`Import failed: ${error.message}`);
			}
			throw new BadRequestException(`Failed to fetch data: ${error.message}`);
		}
	}

	private findArray(obj: any): any[] | null {
		if (Array.isArray(obj)) {
			return obj;
		}

		if (obj && typeof obj === "object") {
			// Prioritize known collection keys
			if (Array.isArray(obj.products)) return obj.products;
			if (Array.isArray(obj.items)) return obj.items;
			if (Array.isArray(obj.nodes)) return obj.nodes;
			if (Array.isArray(obj.edges)) {
				// Handle Relay-style edges { node: ... }
				return obj.edges.map((edge: any) => edge.node);
			}

			// Recursive search
			for (const key of Object.keys(obj)) {
				// Skip common metadata or error keys to avoid false positives
				if (["errors", "extensions", "pageInfo", "meta"].includes(key)) continue;

				const result = this.findArray(obj[key]);
				if (result) return result;
			}
		}

		return null;
	}

	private async processArray(products: any[]) {
		const jobs = products.map((product) => ({
			name: "process-product",
			data: product,
			opts: { removeOnComplete: true, attempts: 3 },
		}));

		await this.ingestionQueue.addBulk(jobs);
		this.logger.log(`Successfully queued ${products.length} items.`);
	}
}
