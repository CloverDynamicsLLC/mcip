import { Injectable, Logger } from "@nestjs/common";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AgentState } from "../agent/agent.state";
import { BaseNode } from "./base.node";
import { ProductVerificationSchema } from "../schemas/product-verification.schema";
import { SearchResult } from "../../repository/interfaces/product.repository.interface";

/**
 * Node responsible for verifying search results using LLM.
 * Filters the final results based on semantic match to the user query.
 */
@Injectable()
export class LlmVerificationNode extends BaseNode {
    protected readonly logger = new Logger(LlmVerificationNode.name);

    constructor(private readonly model: BaseChatModel) {
        super();
    }

    /**
     * Use LLM to verify which products actually match the user's intent
     */
    async execute(state: typeof AgentState.State) {
        const userQuery = this.getUserQuery(state);
        const candidates = state.finalResults;

        if (candidates.length === 0) {
            this.logger.debug("No candidates to verify, skipping LLM verification");
            return { finalResults: [], llmVerificationReasoning: "No products to verify" };
        }

        const productsContext = this.formatProductsForPrompt(candidates);

        const systemMsg = `You are a product attribute validator for an e-commerce search system.

User Query: "${userQuery}"

Candidate Products:
${productsContext}

TASK: Filter products based on EXPLICIT ATTRIBUTE REQUIREMENTS in the user query.

STRICT FILTERING RULES (exclude products that violate these):
1. COLOR: If user specifies a color (e.g., "red shoes"), exclude products that don't match that color.
2. SIZE: If user specifies a size (e.g., "size 10", "large"), exclude mismatches.
3. BRAND: If user specifies a brand, only include that brand.
4. SPECIFIC ATTRIBUTES: If user mentions specific specs (e.g., "16GB RAM", "OLED screen"), filter accordingly.
5. CATEGORY: If user mentions a category and product doesn't fit, exclude it.

DO NOT FILTER ON RELATIVE/SUPERLATIVE TERMS:
- "cheapest", "most affordable", "budget" → Return ALL candidates (sorting handles this)
- "best", "top", "premium", "high-end" → Return ALL candidates
- "fastest", "most powerful" → Return ALL candidates
- "popular", "trending" → Return ALL candidates

These relative terms are handled by search ranking, not by filtering.

INCLUDE products when:
- They match ALL explicit attribute requirements from the query
- They belong to the correct category
- No explicit attribute conflicts exist

Return the IDs of products that pass the attribute filters. If no explicit attributes are mentioned, return ALL product IDs.

IMPORTANT: Return product IDs exactly as provided. Do not invent or modify IDs.
`;

        try {
            const structuredModel = this.model.withStructuredOutput(ProductVerificationSchema);
            const result = await structuredModel.invoke(systemMsg);

            // Filter to only valid IDs that exist in candidates
            const candidateIds = new Set(candidates.map((c) => c.product.externalId));
            const validIds = result.validProductIds.filter((id) => candidateIds.has(id));

            // Rebuild finalResults with only verified products
            const verifiedResults = candidates.filter((c) => validIds.includes(c.product.externalId));

            this.logger.log(`LLM verification: ${verifiedResults.length}/${candidates.length} products passed`);
            this.logger.debug(`Reasoning: ${result.reasoning}`);

            return {
                finalResults: verifiedResults,
                llmVerificationReasoning: result.reasoning,
            };
        } catch (error) {
            this.logger.error(`LLM verification failed: ${error.message}`);
            // On failure, return all candidates (fail-open)
            return {
                finalResults: candidates,
                llmVerificationReasoning: `Verification failed: ${error.message}`,
            };
        }
    }

    /**
     * Format products into a concise prompt format
     */
    private formatProductsForPrompt(results: SearchResult[]): string {
        return results
            .map((r) => {
                const p = r.product;
                const attrs = p.attributes?.slice(0, 5).map((a) => `${a.name}: ${a.value}`).join(", ") ?? "";
                const priceStr = p.price ? `${p.price.amount} ${p.price.currency}` : "N/A";
                return `ID: ${p.externalId} | Title: ${p.title} | Brand: ${p.brand ?? "N/A"} | Category: ${p.category ?? "N/A"} | Price: ${priceStr} | Attrs: [${attrs}]`;
            })
            .join("\n");
    }
}
