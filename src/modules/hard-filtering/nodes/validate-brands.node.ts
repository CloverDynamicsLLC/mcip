import { Injectable, Logger } from "@nestjs/common";
import { AgentState } from "../agent/agent.state";
import { BaseNode } from "./base.node";
import { BrandValidationStatus } from "../schemas/extraction.schema";

/**
 * Node responsible for validating user's intended brands against available store brands.
 *
 * This is the second step of a two-step brand extraction process:
 * 1. ExtractIntendedBrandNode: Extract what brands user is looking for
 * 2. ValidateBrandsNode: Validate against available brands in store (this node)
 *
 * Validation statuses:
 * - no_brand_specified: User didn't ask for any specific brand
 * - matched: All intended brands exist in store
 * - partial: Some intended brands exist (at least one matched)
 * - not_found: User wanted specific brands but NONE exist in store
 */
@Injectable()
export class ValidateBrandsNode extends BaseNode {
	protected readonly logger = new Logger(ValidateBrandsNode.name);

	/**
	 * Validate intended brands against available brands in the store
	 */
	async execute(state: typeof AgentState.State) {
		const { intendedBrands, availableAttributes } = state;
		const availableBrands = availableAttributes.brands ?? [];

		this.logger.debug(
			`Validating intended brands: [${intendedBrands.brands.join(", ")}] ` +
				`against available: [${availableBrands.join(", ")}]`
		);

		// If user didn't specify any brands, no validation needed
		if (intendedBrands.brands.length === 0 && intendedBrands.excludeBrands.length === 0) {
			this.logger.debug("No brands specified by user, skipping validation");
			return {
				brandValidationStatus: "no_brand_specified" as BrandValidationStatus,
				extraction: {
					brands: [],
					excludeBrands: [],
				},
			};
		}

		// Validate include brands
		const matchedBrands = this.validateBrands(intendedBrands.brands, availableBrands);

		// Validate exclude brands (these don't affect validation status)
		const matchedExcludeBrands = this.validateBrands(intendedBrands.excludeBrands, availableBrands);

		// Determine validation status based on include brands only
		let status: BrandValidationStatus;

		if (intendedBrands.brands.length === 0) {
			// User only specified exclude brands, no include brands
			status = "no_brand_specified";
		} else if (matchedBrands.length === 0) {
			// User wanted specific brands but none exist in store
			status = "not_found";
			this.logger.warn(
				`Brand validation failed: User requested [${intendedBrands.brands.join(", ")}] ` +
					`but none found in store`
			);
		} else if (matchedBrands.length === intendedBrands.brands.length) {
			// All intended brands found in store
			status = "matched";
			this.logger.debug(`All intended brands matched: [${matchedBrands.join(", ")}]`);
		} else {
			// Some brands found, some not
			status = "partial";
			const missingBrands = intendedBrands.brands.filter(
				(b) => !matchedBrands.some((m) => m.toLowerCase() === b.toLowerCase())
			);
			this.logger.debug(
				`Partial brand match: Found [${matchedBrands.join(", ")}], ` + `missing [${missingBrands.join(", ")}]`
			);
		}

		return {
			brandValidationStatus: status,
			extraction: {
				brands: matchedBrands,
				excludeBrands: matchedExcludeBrands,
			},
		};
	}

	/**
	 * Validate brands against available list with case-insensitive matching
	 * Returns matched brands with original casing from available list
	 */
	private validateBrands(intended: string[], available: string[]): string[] {
		if (!intended?.length || !available?.length) return [];

		// Create case-insensitive lookup map
		const availableMap = new Map(available.map((b) => [b.toLowerCase(), b]));

		return intended
			.map((brand) => availableMap.get(brand.toLowerCase()))
			.filter((brand): brand is string => brand !== undefined);
	}
}
