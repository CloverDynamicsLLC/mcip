import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OpenAI } from "openai";
import { VectorizationService } from "../vectorization.service.interface";
import { UnifiedProduct } from "../../../../domain/product.schema";

@Injectable()
export class OpenAiVectorizationService implements VectorizationService {
	private readonly logger = new Logger(OpenAiVectorizationService.name);
	private openai: OpenAI;

	constructor(private configService: ConfigService) {
		this.openai = new OpenAI({
			apiKey: this.configService.get<string>("OPENAI_API_KEY"),
		});
	}

	/**
	 * Converts string into a vector.
	 * We use the same model as ingestion to ensure they match mathematically.
	 */
	async embedString(query: string): Promise<number[]> {
		const response = await this.openai.embeddings.create({
			model: "text-embedding-3-small",
			input: query,
			encoding_format: "float",
		});
		return response.data[0].embedding;
	}

	/**
	 * Embedding Generation
	 * Converts the product into a text blob, then into a vector.
	 */
	async embedProduct(product: UnifiedProduct): Promise<number[]> {
		// We don't just embed the whole JSON. We create a "Searchable String".
		// We prioritize fields that users actually search for.
		const textToEmbed = `
      Title: ${product.title}
      Brand: ${product.brand}
      Category: ${product.category}
      Description: ${product.description}
      Keywords: ${product.keywords.join(", ")}
      Attributes: ${product.attributes.map((a) => `${a.name}: ${a.value}`).join(", ")}
    `.trim();

		return this.embedString(textToEmbed);
	}
}

