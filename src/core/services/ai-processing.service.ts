import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OpenAI } from "openai";
import { UnifiedProduct, UnifiedProductSchema } from "../domain/product.schema";
import { zodResponseFormat } from "openai/helpers/zod";

@Injectable()
export class AiProcessingService {
  private readonly logger = new Logger(AiProcessingService.name);
  private openai: OpenAI;

	constructor(private configService: ConfigService) {
		this.openai = new OpenAI({
			apiKey: this.configService.get<string>('OPENAI_API_KEY'),
		});
	}

	/**
	 * Main public method.
	 * Takes raw data, cleans it, and prepares it for the Vector DB.
	 */
	async processRawProduct(rawInput: any) {
		this.logger.log(`Processing product with external ID: ${rawInput.id || "unknown"}`);

		// Step 1: Normalize Data using LLM
		const cleanProduct = await this.normalizeData(rawInput);

		// Step 2: Generate Vector Embedding
		const vector = await this.generateEmbedding(cleanProduct);

		// Return the package ready for Qdrant
		return {
			payload: cleanProduct, // The clean JSON to show on UI
			vector: vector, // The math representation for search
		};
	}

	/**
	 * STEP 1: Normalization
	 * Uses GPT-4o-mini to force raw data into our Zod Schema.
	 */
	private async normalizeData(rawInput: any): Promise<UnifiedProduct> {
		const completion = await this.openai.chat.completions.parse({
			model: "gpt-4o-mini",
			messages: [
				{
					role: "system",
					content: `
            You are an expert E-commerce Data Cleaner.
            Transform the user's raw product data into the strictly defined schema.
            
            Rules:
            1. INFER: If category is missing, guess it from the title.
            2. FORMAT: Fix capitalization (e.g. "NIKE" -> "Nike").
            3. CLEAN: Remove HTML tags from descriptions.
            4. KEYWORDS: Generate 5-10 SEO keywords based on the product details.
            5. PRICE: Ensure price is a number. If currency is missing, default to UAH.
          `,
				},
				{
					role: "user",
					content: JSON.stringify(rawInput),
				},
			],
			response_format: zodResponseFormat(UnifiedProductSchema, "product"),
		});

		const result = completion.choices[0].message.parsed;

		if (!result) {
			throw new Error("LLM failed to parse product data");
		}

		return result;
	}

	/**
	 * STEP 2: Embedding Generation
	 * Converts the product into a text blob, then into a vector.
	 */
	private async generateEmbedding(product: UnifiedProduct): Promise<number[]> {
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

		const response = await this.openai.embeddings.create({
			model: "text-embedding-3-small", // Efficient embedding model
			input: textToEmbed,
			encoding_format: "float",
		});

		return response.data[0].embedding;
	}
}
