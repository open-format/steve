import { type Evaluator, type IAgentRuntime, type Memory, elizaLogger, stringToUuid } from "@elizaos/core";
import type { Client as DiscordClient } from "discord.js";
import { sendMessageInChunks } from "../../../clients/discord/utils";
import { RewardService } from "../services/rewardService";
import { ScoringService } from "../services/scoringService";
import { getDiscordMessageFromMemory } from "../utils/discord";

export const scoringEvaluator: Evaluator = {
  name: "DISCORD_MESSAGE_SCORING",
  similes: [],
  description: "Evaluates the quality of a Discord message and rewards the user if the conditions are met",
  examples: [],
  alwaysRun: true,
  validate: async (runtime: IAgentRuntime, memory: Memory) => {
    const discordClient: DiscordClient = runtime.clients.discord.client;
    const discordMessage = await getDiscordMessageFromMemory(runtime, memory);

    elizaLogger.info("Skipping scoring evaluator for self-message", {
      discordClientUserId: discordClient?.user?.id,
      discordMessageAuthorId: discordMessage?.author.id,
    });

    if (discordClient?.user?.id === discordMessage?.author.id) {
      return false;
    }
    const alreadyProcessed = await runtime.messageManager.getMemoryById(
      stringToUuid(`${discordMessage?.id}-${runtime.agentId}-${discordMessage?.author.id}-reward`)
    );

    if (alreadyProcessed?.id) {
      return false;
    }
    return true;
  },
  handler: async (runtime: IAgentRuntime, memory: Memory, state, options, callback): Promise<boolean> => {
    try {
      // Only process Discord messages
      if (memory.content.source !== "discord") {
        return false;
      }

      // Initialize services
      const scoringService = new ScoringService(runtime);
      const rewardService = new RewardService(runtime);

      if (!memory.content.url) {
        elizaLogger.warn("No URL found in memory", {
          memory,
        });
        return false;
      }
      const discordMessage = await getDiscordMessageFromMemory(runtime, memory);
      if (!discordMessage) {
        return false;
      }

      const alreadyProcessed = await runtime.messageManager.getMemoryById(
        stringToUuid(`${discordMessage.id}-${runtime.agentId}-${discordMessage.author.id}-reward`)
      );

      if (alreadyProcessed?.id) {
        elizaLogger.info("Skipping scoring evaluator for already processed message", {
          memory,
        });
        return false;
      }

      // Calculate total score
      const score = await scoringService.evaluateMessage(discordMessage);

      if (score.meetsConditions) {
        // Call reward API
        const apiResponse = await rewardService.callRewardAPI(memory, score);

        await sendMessageInChunks(
          discordMessage?.channel,
          "You have been rewarded for your message + " + apiResponse.message
        );

        // Create a new memory for the reward
        const rewardMemory: Memory = {
          id: stringToUuid(`${discordMessage.id}-${runtime.agentId}-${discordMessage.author.id}-reward`),
          userId: memory.userId,
          content: {
            source: "discord",
            url: discordMessage.url,
            text: "User rewarded for message quality",
            meetsConditions: score.meetsConditions,
            qualityScore: score.qualityScore,
            trustScore: score.trustScore,
          },
          agentId: runtime.agentId,
          roomId: memory.roomId,
          createdAt: discordMessage.createdTimestamp,
        };

        // Store the reward memory
        await runtime.messageManager.createMemory(rewardMemory);
        await runtime.messageManager.addEmbeddingToMemory(rewardMemory);

        // Log successful reward
        elizaLogger.log("Message Rewarded", {
          messageId: memory.id,
          userId: memory.userId,
          score,
        });

        return true;
      }

      return false;
    } catch (error) {
      elizaLogger.error("Error in scoring evaluator", error);
      return false;
    }
  },
};
