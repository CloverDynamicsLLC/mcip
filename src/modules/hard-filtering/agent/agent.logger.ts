import { ConsoleLogger, Injectable } from "@nestjs/common";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { Serialized } from "@langchain/core/load/serializable";

@Injectable()
export class AgentLogger extends BaseCallbackHandler {
	private readonly logger = new ConsoleLogger("LangGraph");
	name: string = "NestJS_Agent_Logger";

	// Triggered when the LLM starts "thinking"
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async handleLLMStart(_llm: Serialized, _prompts: string[]) {
		this.logger.log(`LLM Started thinking...`);
	}

	// Triggered when the LLM finishes generating a response
	async handleLLMEnd(output: any) {
		const generations = output.generations[0][0];
		// Check if the LLM decided to call a tool
		if (generations.message?.tool_calls?.length > 0) {
			this.logger.log(`LLM Decided to call tool: ${JSON.stringify(generations.message.tool_calls, null, 2)}`);
		} else {
			this.logger.log(`LLM Response: ${generations.text}`);
		}
	}

	// Triggered when a Tool is about to run
	async handleToolStart(tool: Serialized, input: string) {
		this.logger.warn(`Tool Execution Started: [${tool.id.join("_")}]`);
		this.logger.warn(`Input: ${input}`);
	}

	// Triggered when a Tool finishes running
	async handleToolEnd(output: string) {
		this.logger.log(`Tool Execution Finished`);
		this.logger.log(`Result: ${output}`);
	}

	// Triggered if an error occurs anywhere
	async handleChainError(err: any) {
		this.logger.error(`Graph Error: ${err.message}`);
	}
}
