import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OpenAI } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { UnifiedProduct, UnifiedProductSchema } from "../../../../domain/product.schema";
import { ProductMapper } from "../product-mapper.interface";

@Injectable()
export class CustomAiMapper implements ProductMapper {
	private readonly logger = new Logger(CustomAiMapper.name);
	private openai: OpenAI;

	constructor(private configService: ConfigService) {
		this.openai = new OpenAI({
			apiKey: this.configService.get<string>("OPENAI_API_KEY"),
		});
	}

	async map(rawInput: any): Promise<UnifiedProduct> {
		this.logger.log(`Mapping product using LLM: ${rawInput.id || "unknown"}`);

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
            6. METADATA: Extract 'brand' and 'category' from the title or description if not explicitly provided.
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
}
