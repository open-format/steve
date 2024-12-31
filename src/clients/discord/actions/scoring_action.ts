import type { Message, TextChannel } from "discord.js";
import type { ScoringAction } from "../types";
import { sendMessageInChunks } from "../utils";

export const scoringAction: ScoringAction = {
  name: "cat-facts",
  handler: async (message: Message, meetsConditions: boolean) => {
    if (!meetsConditions) return;

    const catFactsResponse = await fetch("https://catfact.ninja/fact");
    const catFactsData = await catFactsResponse.json();
    const catFact = catFactsData.fact;

    await sendMessageInChunks(
      message.channel as TextChannel,
      `<@${message.author.id}>, your [message](https://discord.com/channels/${message.guildId}/${message.channel.id}/${message.id}) is popular! Here's a cat fact as a reward: ${catFact}`,
      message.id,
      []
    );
  },
};
