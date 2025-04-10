import type { Client, IAgentRuntime } from "@elizaos/core";
import { elizaLogger } from "@elizaos/core";
import { validateTelegramConfig } from "./environment";
import { TelegramClient } from "./telegramClient";

export const TelegramClientInterface: Client = {
  start: async (runtime: IAgentRuntime) => {
    await validateTelegramConfig(runtime);

    const tg = new TelegramClient(runtime, runtime.getSetting("TELEGRAM_BOT_TOKEN") as string);

    await tg.start();

    elizaLogger.success(`✅ Telegram client successfully started for character ${runtime.character.name}`);
    return tg;
  },
  stop: async (_runtime: IAgentRuntime) => {
    elizaLogger.warn("Telegram client does not support stopping yet");
  },
};

export default TelegramClientInterface;
