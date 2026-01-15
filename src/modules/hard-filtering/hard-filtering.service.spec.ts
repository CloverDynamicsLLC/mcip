import { Test, TestingModule } from "@nestjs/testing";
import { HardFilteringService } from "./hard-filtering.service";
import { ConfigModule } from "@nestjs/config";
import { HardFilteringModule } from "./hard-filtering.module";

describe("HardFilteringService", () => {
	let searchAgentService: HardFilteringService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			imports: [await ConfigModule.forRoot(), HardFilteringModule],
		}).compile();

		searchAgentService = module.get<HardFilteringService>(HardFilteringService);
	});

	jest.setTimeout(20000);

	it("should extract parameters using Real OpenAI", async () => {
		const userQuery = "I want laptop Lenovo under 1000$";

		console.log(`Sending query to OpenAI: "${userQuery}"...`);

		// Act
		const result = await searchAgentService.entrypoint(userQuery);

		console.log("OpenAI Response:", result);

		// Assert
		// We use .toMatch for strings to be safe against case sensitivity (Lenovo vs lenovo)
		expect(result.category).toMatch(/laptop/i);
		expect(result.brand).toMatch(/Lenovo/i);

		// Numbers are usually exact, but logic check is key
		expect(result.price).toBeDefined();
		expect(result.price?.amount).toBe(1000);
		expect(result.price?.operator).toBe("lt"); // lt = less than
	});
});
