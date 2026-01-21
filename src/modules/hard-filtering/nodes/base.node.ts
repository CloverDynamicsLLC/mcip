import { Logger } from "@nestjs/common";
import { AgentState } from "../agent/agent.state";

/**
 * Base class for LangGraph nodes providing common utilities
 */
export abstract class BaseNode {
	protected abstract readonly logger: Logger;

	/**
	 * Get the user query from the last message in state
	 */
	protected getUserQuery(state: typeof AgentState.State): string {
		const lastMessage = state.messages[state.messages.length - 1];
		return (lastMessage?.content as string) ?? "";
	}
}
