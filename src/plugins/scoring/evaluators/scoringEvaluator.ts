import { type Evaluator, type IAgentRuntime, type Memory, elizaLogger } from "@elizaos/core";
import { sendMessageInChunks } from "../../../clients/discord/utils";
import { getDiscordMessageFromMemory } from "../providers/scoringProvider";
import { ScoringService } from "../service";
import { RewardService } from "../services/rewardService";

export const scoringEvaluator: Evaluator = {
  name: "DISCORD_MESSAGE_SCORING",
  similes: [],
  description: "Evaluates the quality of a Discord message and rewards the user if the conditions are met",
  examples: [],
  alwaysRun: true,
  validate: async () => true,
  handler: async (runtime: IAgentRuntime, memory: Memory, state, options, callback): Promise<boolean> => {
    elizaLogger.info("Evaluating handler...", {
      memory,
    });
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

      // Calculate total score
      const score = await scoringService.evaluateMessage(discordMessage);

      if (score.meetsConditions) {
        // Check if this message has already been processed
        const alreadyProcessed = await runtime.cacheManager.get(`processed_message:${memory.id}`);

        if (!alreadyProcessed) {
          // Call reward API
          const apiResponse = await rewardService.callRewardAPI(memory, score);
          await sendMessageInChunks(discordMessage?.channel, "You have been rewarded for your message");

          // Store processed message in cache
          await runtime.cacheManager.set(`processed_message:${memory.id}`, {
            processedAt: Date.now(),
            score,
            apiResponse,
          });

          // Log successful reward
          elizaLogger.log("Message Rewarded", {
            messageId: memory.id,
            userId: memory.userId,
            score,
          });

          return true;
        }

        elizaLogger.warn("Message already processed", {
          messageId: memory.id,
          userId: memory.userId,
        });
      }

      return false;
    } catch (error) {
      elizaLogger.error("Error in scoring evaluator", error);
      return false;
    }
  },
};
