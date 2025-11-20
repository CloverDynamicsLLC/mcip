import { Injectable, Logger } from "@nestjs/common";
import { UnifiedProduct, CurrencyEnum } from "../../../core/domain/product.schema";
import { ProductMapper } from "../product-mapper.interface";

@Injectable()
export class VendureMapper implements ProductMapper {
    private readonly logger = new Logger(VendureMapper.name);

    async map(raw: any): Promise<UnifiedProduct> {
        this.logger.log(`Mapping product using Vendure Strategy: ${raw.id || "unknown"}`);

        this.logger.debug(`Raw product data: ${JSON.stringify(raw, null, 2)}`);

        // Basic validation
        if (!raw || typeof raw !== 'object') {
            throw new Error("Invalid raw product data");
        }

        // Helper to get price from variants or top level
        const price = this.extractPrice(raw);
        
        // Helper to get image
        const mainImage = this.extractImage(raw);

        // Helper to get category
        const category = this.extractCategory(raw);

        // Helper to get attributes
        const attributes = this.extractAttributes(raw);

        const unified: UnifiedProduct = {
            externalId: String(raw.id || raw.productId || ''),
            url: raw.slug ? `/product/${raw.slug}` : '', // Assuming relative URL or construct absolute if base URL known
            title: raw.name || raw.title || 'Untitled Product',
            description: this.stripHtml(raw.description || ''),
            category: category,
            brand: this.extractBrand(raw) || 'Unknown Brand',
            price: {
                amount: price.amount,
                currency: price.currency as any // Type assertion needed if string doesn't perfectly match enum
            },
            mainImage: mainImage,
            attributes: attributes,
            variants: [], // Populate if needed
            keywords: this.generateKeywords(raw.name, raw.description)
        };

        return unified;
    }

    private extractPrice(raw: any): { amount: number, currency: string } {
        // Check for variants price
        if (Array.isArray(raw.variants) && raw.variants.length > 0) {
            const firstVariant = raw.variants[0];
            return {
                amount: Number(firstVariant.price) || 0,
                currency: firstVariant.currencyCode || 'UAH'
            };
        }
        // Fallback to root level price
        return {
            amount: Number(raw.price) || 0,
            currency: raw.currencyCode || 'UAH'
        };
    }

    private extractImage(raw: any): string {
        if (raw.featuredAsset && raw.featuredAsset.preview) {
            return raw.featuredAsset.preview;
        }
        if (Array.isArray(raw.assets) && raw.assets.length > 0) {
            return raw.assets[0].preview || raw.assets[0].source;
        }
        return '';
    }

    private extractCategory(raw: any): string {
        if (Array.isArray(raw.collections) && raw.collections.length > 0) {
            return raw.collections.map((c: any) => c.name).join(' > ');
        }
        return 'Uncategorized';
    }

    private extractAttributes(raw: any): any[] {
        if (Array.isArray(raw.facetValues)) {
            return raw.facetValues.map((fv: any) => ({
                name: fv.facet ? fv.facet.name : 'Attribute',
                value: fv.name
            }));
        }
        return [];
    }

    private extractBrand(raw: any): string {
        // Vendure doesn't have a standard "Brand" field usually, often handled via Facets.
        // We look for a facet named "Brand".
        if (Array.isArray(raw.facetValues)) {
            const brandFacet = raw.facetValues.find((fv: any) => fv.facet && fv.facet.name.toLowerCase() === 'brand');
            if (brandFacet) {
                return brandFacet.name;
            }
        }
        return 'Generic';
    }

    private stripHtml(html: string): string {
        return html.replace(/<[^>]*>?/gm, '');
    }

    private generateKeywords(title: string, description: string): string[] {
        // Simple keyword extraction
        const text = `${title} ${description}`.toLowerCase();
        const words = text.split(/\s+/).filter(w => w.length > 3);
        // Return unique top 5 words (dummy implementation)
        return [...new Set(words)].slice(0, 5);
    }
}

