import { type Action, elizaLogger } from "@elizaos/core";
import { DiscordClient } from "../../../clients/discord";
import { ScoringService } from "../service";

export const scoringAction: Action = {
  name: "PROCESS_SCORE",
  similes: ["score", "evaluate", "validate"],
  description: "Processes message scoring results",
  // Added to context.
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Can you summarize the attachments b3e23, c4f67, and d5a89?",
          action: "PROCESS_SCORE",
        },
      },
    ],
    [
      {
        user: "{{user2}}",
        content: {
          text: "Please analyze the sentiment: I'm very disappointed with the product",
          action: "PROCESS_SCORE",
        },
      },
    ],
  ],
  validate: async (runtime, message) => {
    elizaLogger.log("Scoring action validate called", message);
    // Your existing validation logic
    return true;
  },
  handler: async (runtime, message, state, options, callback) => {
    function parseDiscordUrl(url: string) {
      const urlObj = new URL(url);
      const parts = urlObj.pathname.split("/");
      const guildId = parts[1];
      const channelId = parts[2];
      const messageId = parts[4];
      return { guildId, channelId, messageId };
    }
    const scoring = new ScoringService(runtime);
    const { client } = new DiscordClient(runtime);
    const { guildId, channelId, messageId } = parseDiscordUrl(message.content.url);
    const guild = await client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(channelId);

    const discordMessage = await channel?.messages.fetch(messageId);
    if (!discordMessage) {
      throw new Error("Could not fetch Discord message");
    }

    const result = await scoring.evaluateMessage(discordMessage);

    elizaLogger.log("Scoring result", result);

    elizaLogger.log("Scoring action handler called", message);
    callback?.({
      text: "Message processed with scoring resultssssss",
    });
    return {
      text: "Message processed with scoring results",
    };
  },
};
