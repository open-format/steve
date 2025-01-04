import { type IAgentRuntime, type Memory, type Provider, type State, elizaLogger } from "@elizaos/core";
import type { Client as DiscordClient, Message } from "discord.js";
import { ScoringService } from "../service";

interface DiscordMessageUrlParts {
  guildId: string;
  channelId: string;
  messageId: string;
}

function parseDiscordMessageUrl(url: string): DiscordMessageUrlParts | null {
  try {
    // Validate input
    if (!url) {
      elizaLogger.warn("No URL provided");
      return null;
    }

    // Create URL object for more robust parsing
    const parsedUrl = new URL(url);

    // Validate domain
    if (parsedUrl.hostname !== "discord.com") {
      elizaLogger.warn("Invalid Discord URL domain", { url });
      return null;
    }

    // Split path segments
    const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);

    // Validate path structure
    if (pathSegments.length !== 4 || pathSegments[0] !== "channels") {
      elizaLogger.warn("Malformed Discord message URL", {
        url,
        pathSegments,
        expectedFirstSegment: pathSegments[0],
        segmentLength: pathSegments.length,
      });
      return null;
    }

    // Correctly extract guildId, channelId, and messageId
    const [, guildId, channelId, messageId] = pathSegments;

    // Validate IDs are numeric strings
    if (
      !guildId ||
      !channelId ||
      !messageId ||
      !/^\d+$/.test(guildId) ||
      !/^\d+$/.test(channelId) ||
      !/^\d+$/.test(messageId)
    ) {
      elizaLogger.warn("Invalid Discord URL IDs", { url, guildId, channelId, messageId });
      return null;
    }

    return { guildId, channelId, messageId };
  } catch (error) {
    elizaLogger.error("Error parsing Discord message URL", error);
    return null;
  }
}

export async function getDiscordMessageFromMemory(runtime: IAgentRuntime, memory: Memory): Promise<Message | null> {
  try {
    // Validate input
    if (!memory.content?.url) {
      elizaLogger.warn("No URL provided in memory", { memoryId: memory.id });
      return null;
    }

    // Parse Discord message URL
    const parsedUrl = parseDiscordMessageUrl(memory.content.url);

    if (!parsedUrl) {
      elizaLogger.warn("Invalid Discord message URL format", { url: memory.content.url });
      return null;
    }

    const { guildId, channelId, messageId } = parsedUrl;

    // Retrieve Discord client from runtime
    const discordClient: DiscordClient = runtime.clients.discord.client;

    if (!discordClient) {
      elizaLogger.error("Discord client not initialized");
      return null;
    }

    // Fetch the guild
    const guild = await discordClient.guilds.fetch(guildId);
    if (!guild) {
      elizaLogger.warn("Guild not found", { guildId });
      return null;
    }

    // Fetch the channel
    const channel = await guild.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      elizaLogger.warn("Channel not found or not text-based", { channelId });
      return null;
    }

    // Fetch the message
    const message = (await channel.messages.fetch(messageId)) as Message;

    if (!message) {
      elizaLogger.warn("Message not found", { messageId });
      return null;
    }

    return message;
  } catch (error) {
    elizaLogger.error("Error retrieving Discord message", error);
    return null;
  }
}

export const scoringProvider: Provider = {
  get: async (runtime: IAgentRuntime, memory: Memory, state?: State) => {
    try {
      // Retrieve Discord message
      const message = await getDiscordMessageFromMemory(runtime, memory);

      if (!message) {
        return "Unable to retrieve Discord message";
      }

      // Initialize scoring service
      const scoringService = new ScoringService(runtime);

      // Evaluate the message
      const score = await scoringService.evaluateMessage(message);

      // Log the scoring details
      elizaLogger.log("Scoring provider", {
        messageId: message.id,
        score,
        userId: message.author.id,
      });

      // Return the score as a string for context
      return `Message Scoring Details:
- Quality Score: ${score.qualityScore}
- Trust Score: ${score.trustScore}
- Meets Conditions: ${score.meetsConditions}
- Message ID: ${message.id}
- User ID: ${message.author.id}`;
    } catch (error) {
      elizaLogger.error("Error in scoring provider", error);
      return "Scoring temporarily unavailable";
    }
  },
};
