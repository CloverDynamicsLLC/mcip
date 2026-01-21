import { Injectable, Logger } from "@nestjs/common";
import { AgentState } from "../agent/agent.state";
import { AttributeMap } from "../schemas/extraction.schema";
import { BaseNode } from "./base.node";
import { UnifiedProduct } from "../../../domain/product.schema";

/**
 * Node responsible for extracting common attributes from intermediate products
 */
@Injectable()
export class ExtractCommonAttributesNode extends BaseNode {
	protected readonly logger = new Logger(ExtractCommonAttributesNode.name);

	/**
	 * Minimum percentage of products that must have an attribute for it to be considered "common"
	 */
	private readonly COMMON_ATTRIBUTE_THRESHOLD = 0.3;

	/**
	 * Maximum number of unique values per attribute to consider
	 * (prevents memory issues with high-cardinality attributes)
	 */
	private readonly MAX_VALUES_PER_ATTRIBUTE = 20;

	/**
	 * Extract common attributes from intermediate products
	 */
	async execute(state: typeof AgentState.State) {
		const products = state.intermediateProducts;

		if (products.length === 0) {
			this.logger.debug("No intermediate products, skipping attribute extraction");
			return { discoveredAttributes: [] };
		}

		const commonAttributes = this.extractCommonAttributes(products);

		this.logger.log(`Discovered ${commonAttributes.length} common attributes`);
		this.logger.debug(`Attributes: ${commonAttributes.map((a) => a.key).join(", ")}`);

		return { discoveredAttributes: commonAttributes };
	}

	/**
	 * Analyze products and extract attributes that appear frequently
	 */
	private extractCommonAttributes(products: UnifiedProduct[]): AttributeMap[] {
		// Map: attributeName -> Map<value, count>
		const attributeMap = new Map<string, Map<string, number>>();

		// Aggregate all attributes
		for (const product of products) {
			const seenAttributes = new Set<string>();

			for (const attr of product.attributes ?? []) {
				const name = attr.name;
				const value = String(attr.value);

				// Skip empty values
				if (!value || value.trim() === "") continue;

				// Track unique attribute names per product (for threshold calculation)
				seenAttributes.add(name);

				if (!attributeMap.has(name)) {
					attributeMap.set(name, new Map());
				}

				const valueMap = attributeMap.get(name)!;
				valueMap.set(value, (valueMap.get(value) ?? 0) + 1);
			}
		}

		// Filter to common attributes
		const threshold = Math.max(1, Math.ceil(products.length * this.COMMON_ATTRIBUTE_THRESHOLD));
		const commonAttributes: AttributeMap[] = [];

		for (const [name, valueMap] of attributeMap) {
			// Count how many products have this attribute
			const totalOccurrences = Array.from(valueMap.values()).reduce((a, b) => a + b, 0);

			if (totalOccurrences >= threshold) {
				// Get most common values, limited to MAX_VALUES_PER_ATTRIBUTE
				const sortedValues = Array.from(valueMap.entries())
					.sort((a, b) => b[1] - a[1])
					.slice(0, this.MAX_VALUES_PER_ATTRIBUTE)
					.map(([value]) => value);

				commonAttributes.push({
					key: name,
					values: sortedValues,
				});
			}
		}

		// Sort by attribute name for consistent ordering
		return commonAttributes.sort((a, b) => a.key.localeCompare(b.key));
	}
}
