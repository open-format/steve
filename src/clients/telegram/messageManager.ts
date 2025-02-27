import {
  type Content,
  type IAgentRuntime,
  type Memory,
  type UUID,
  elizaLogger,
  getEmbeddingZeroVector,
  stringToUuid,
} from "@elizaos/core";
import type { Context, Telegraf } from "telegraf";

interface MessageContext {
  content: string;
  timestamp: number;
}

export type InterestChats = {
  [key: string]: {
    currentHandler: string | undefined;
    lastMessageSent: number;
    messages: { userId: UUID; userName: string; content: Content }[];
    previousContext?: MessageContext;
    contextSimilarityThreshold?: number;
  };
};

export class MessageManager {
  public bot: Telegraf<Context>;
  private runtime: IAgentRuntime;

  constructor(bot: Telegraf<Context>, runtime: IAgentRuntime) {
    this.bot = bot;
    this.runtime = runtime;
  }

  // Main handler for incoming messages
  public async handleMessage(ctx: Context): Promise<void> {
    if (!ctx.message || !ctx.from) {
      return; // Exit if no message or sender info
    }

    if (this.runtime.character.clientConfig?.telegram?.shouldIgnoreBotMessages && ctx.from.is_bot) {
      return;
    }
    if (this.runtime.character.clientConfig?.telegram?.shouldIgnoreDirectMessages && ctx.chat?.type === "private") {
      return;
    }

    const message = ctx.message;

    try {
      // Convert IDs to UUIDs
      const userId = stringToUuid(ctx.from.id.toString()) as UUID;

      // Get user name
      const userName = ctx.from.username || ctx.from.first_name || "Unknown User";

      // Get chat ID
      const chatId = stringToUuid(`${ctx.chat?.id}-${this.runtime.agentId}`) as UUID;

      // Get agent ID
      const agentId = this.runtime.agentId;

      // Get room ID
      const roomId = chatId;

      // Ensure connection
      await this.runtime.ensureConnection(userId, roomId, userName, userName, "telegram");

      // Get message ID
      const messageId = stringToUuid(`${message.message_id}-${this.runtime.agentId}`) as UUID;

      // Get text or caption
      let messageText = "";
      if ("text" in message) {
        messageText = message.text;
      } else if ("caption" in message && message.caption) {
        messageText = message.caption;
      }

      // Create content
      const content: Content = {
        text: messageText,
        source: "telegram",
        thread_id: message?.message_thread_id ?? 0,
        server_id: ctx.chat?.id.toString() ?? "",
        inReplyTo:
          "reply_to_message" in message && message.reply_to_message
            ? stringToUuid(`${message.reply_to_message.message_id}-${this.runtime.agentId}`)
            : undefined,
      };

      // Create memory for the message
      const memory: Memory = {
        id: messageId,
        agentId,
        userId,
        roomId,
        content,
        createdAt: message.date * 1000,
        embedding: getEmbeddingZeroVector(),
      };

      // Create memory
      await this.runtime.messageManager.createMemory(memory);

      // Update state with the new memory
      let state = await this.runtime.composeState(memory);
      state = await this.runtime.updateRecentMessageState(state);

      return;
    } catch (error) {
      elizaLogger.error("❌ Error handling message:", error);
      elizaLogger.error("Error sending message:", error);
    }
  }
}
