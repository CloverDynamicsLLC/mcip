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
		@InjectQueue("product-ingestion") private readonly ingestionQueue: Queue,
		private readonly configService: ConfigService
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
			if (graphqlQuery) {
				const products = await this.fetchGraphqlPaginated(url, graphqlQuery, apiKey);

				if (!products.length) {
					throw new BadRequestException(
						"API response does not contain an array of products or could not find one in the response"
					);
				}

				await this.queueProducts(products);

				return {
					status: "success",
					message: `Queued ${products.length} products from URL`,
					count: products.length,
				};
			} else {
				const rawData = await this.fetchRest(url, apiKey);
				return await this.processRawData(rawData);
			}
		} catch (error) {
			this.handleImportError(error);
		}
	}

	private async processRawData(rawData: any): Promise<ImportProductsResponseDto> {
		const products = this.findArray(rawData);

		if (!products) {
			throw new BadRequestException(
				"API response does not contain an array of products or could not find one in the response"
			);
		}

		await this.queueProducts(products);

		return {
			status: "success",
			message: `Queued ${products.length} products from URL`,
			count: products.length,
		};
	}

	private async fetchGraphql(
		url: string,
		graphqlQuery: string,
		apiKey?: string,
		variables?: Record<string, unknown>
	): Promise<any> {
		const cleanQuery = graphqlQuery.replace(/\\n/g, "\n");

		const body: Record<string, unknown> = { query: cleanQuery };
		if (variables && Object.keys(variables).length > 0) {
			body.variables = variables;
		}

		const response = await axios.post(url, body, {
			headers: apiKey
				? { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }
				: { "Content-Type": "application/json" },
			timeout: 30000,
		});

		if (response.data.errors && response.data.errors.length > 0) {
			this.logger.warn(`GraphQL Errors reported: ${JSON.stringify(response.data.errors)}`);
		}

		return response.data.data || response.data;
	}

	private detectPaginationMode(query: string): "variables" | "inline" | "none" {
		if (/\$take\s*:\s*Int/i.test(query) && /\$skip\s*:\s*Int/i.test(query)) {
			return "variables";
		}
		if (/take\s*:\s*\d+/.test(query)) {
			return "inline";
		}
		return "none";
	}

	private async fetchGraphqlPaginated(url: string, graphqlQuery: string, apiKey?: string): Promise<unknown[]> {
		const cleanQuery = graphqlQuery.replace(/\\n/g, "\n");
		const PAGE_SIZE = 100;

		const mode = this.detectPaginationMode(cleanQuery);

		if (mode === "none") {
			const data = await this.fetchGraphql(url, graphqlQuery, apiKey);
			const items = this.findArray(data);
			return items || [];
		}

		const take =
			mode === "inline"
				? parseInt(cleanQuery.match(/take\s*:\s*(\d+)/)?.[1] || String(PAGE_SIZE), 10)
				: PAGE_SIZE;

		let queryTemplate = cleanQuery;
		if (mode === "inline") {
			const hasSkip = /skip\s*:\s*\d+/.test(cleanQuery);
			if (!hasSkip) {
				queryTemplate = cleanQuery.replace(/take\s*:\s*\d+/, `take: ${take}, skip: 0`);
			}
		}

		let allProducts: unknown[] = [];
		let skip = 0;
		let hasMore = true;

		while (hasMore) {
			this.logger.log(`Fetching page ${Math.floor(skip / take) + 1} (skip: ${skip}, take: ${take})...`);

			let data: any;
			if (mode === "variables") {
				data = await this.fetchGraphql(url, queryTemplate, apiKey, { take, skip });
			} else {
				const paginatedQuery = queryTemplate.replace(/skip\s*:\s*\d+/, `skip: ${skip}`);
				data = await this.fetchGraphql(url, paginatedQuery, apiKey);
			}

			const pageItems = this.findArray(data);

			if (!pageItems || pageItems.length === 0) {
				break;
			}

			allProducts = allProducts.concat(pageItems);
			this.logger.log(
				`Fetched page ${Math.floor(skip / take) + 1}: ${pageItems.length} items (total so far: ${allProducts.length})`
			);

			if (pageItems.length < take) {
				hasMore = false;
			} else {
				skip += take;
			}
		}

		return allProducts;
	}

	private findArray(obj: Record<string, unknown> | unknown): unknown[] | null {
		if (Array.isArray(obj)) {
			return obj as unknown[];
		}

		if (obj && typeof obj === "object") {
			const record = obj as Record<string, unknown>;
			// Prioritize known collection keys
			if (Array.isArray(record.products)) return record.products as unknown[];
			if (Array.isArray(record.items)) return record.items as unknown[];
			if (Array.isArray(record.nodes)) return record.nodes as unknown[];
			if (Array.isArray(record.edges)) {
				// Handle Relay-style edges { node: ... }
				return (record.edges as Array<Record<string, unknown>>).map((edge) => edge.node);
			}

			// Recursive search
			for (const key of Object.keys(record)) {
				// Skip common metadata or error keys to avoid false positives
				if (["errors", "extensions", "pageInfo", "meta"].includes(key)) continue;

				const result = this.findArray(record[key]);
				if (result) return result;
			}
		}

		return null;
	}

	private async queueProducts(products: any[]) {
		const jobs = products.map((product) => ({
			name: "process-product",
			data: product,
			opts: { removeOnComplete: true, attempts: 3 },
		}));

		await this.ingestionQueue.addBulk(jobs);
		this.logger.log(`Successfully queued ${products.length} items.`);
	}

	private async fetchRest(url: string, apiKey?: string): Promise<any> {
		const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
		const response = await axios.get(url, { headers, timeout: 30000 });
		return response.data;
	}

	private handleImportError(error: any): never {
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
