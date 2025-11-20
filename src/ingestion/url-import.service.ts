import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import axios from 'axios';

@Injectable()
export class UrlImportService {
    private readonly logger = new Logger(UrlImportService.name);

    constructor(
        @InjectQueue('product-ingestion') private ingestionQueue: Queue
    ) { }

    async importFromUrl(url: string, apiKey?: string) {
        this.logger.log(`Started importing from: ${url}`);

        try {
            const response = await axios.get(url, {
                headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {},
                timeout: 30000,
            });

            const data = response.data;

            if (!Array.isArray(data)) {
                // Try to find an array inside the object (e.g. { products: [...] })
                if (data.products && Array.isArray(data.products)) {
                    return this.processArray(data.products);
                }
                throw new BadRequestException('API response is not an array of products');
            }

            await this.processArray(data);

            return {
                status: 'success',
                message: `Queued ${data.length} products from URL`,
                count: data.length
            };

        } catch (error) {
            this.logger.error(`Import failed: ${error.message}`);
            throw new BadRequestException(`Failed to fetch data: ${error.message}`);
        }
    }

    private async processArray(products: any[]) {
        // Prepare jobs for BullMQ
        const jobs = products.map((product) => ({
            name: 'process-product',
            data: product,
            opts: { removeOnComplete: true, attempts: 3 },
        }));

        await this.ingestionQueue.addBulk(jobs);
        this.logger.log(`Successfully queued ${products.length} items.`);
    }
}
