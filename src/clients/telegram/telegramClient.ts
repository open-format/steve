import { type IAgentRuntime, elizaLogger } from "@elizaos/core";
import { type Context, Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { MessageManager } from "./messageManager";

export class TelegramClient {
  private bot: Telegraf<Context>;
  private runtime: IAgentRuntime;
  private messageManager: MessageManager;
  private options;

  constructor(runtime: IAgentRuntime, botToken: string) {
    elizaLogger.log("📱 Constructing new TelegramClient...");
    this.options = {
      telegram: {
        apiRoot: runtime.getSetting("TELEGRAM_API_ROOT") || process.env.TELEGRAM_API_ROOT || "https://api.telegram.org",
      },
    };
    this.runtime = runtime;
    this.bot = new Telegraf(botToken, this.options);
    this.messageManager = new MessageManager(this.bot, this.runtime);
    elizaLogger.log("✅ TelegramClient constructor completed");
  }

  public async start(): Promise<void> {
    elizaLogger.log("🚀 Starting Telegram bot...");
    try {
      await this.initializeBot();
      this.setupMessageHandlers();
      this.setupShutdownHandlers();
    } catch (error) {
      elizaLogger.error("❌ Failed to launch Telegram bot:", error);
      throw error;
    }
  }

  private async initializeBot(): Promise<void> {
    this.bot.launch({ dropPendingUpdates: true });
    elizaLogger.log("✨ Telegram bot successfully launched and is running!");

    const botInfo = await this.bot.telegram.getMe();
    this.bot.botInfo = botInfo;
    elizaLogger.success(`Bot username: @${botInfo.username}`);

    this.messageManager.bot = this.bot;
  }

  private async isGroupAuthorized(ctx: Context): Promise<boolean> {
    const config = this.runtime.character.clientConfig?.telegram;
    if (ctx.from?.id === ctx.botInfo?.id) {
      return false;
    }

    if (!config?.shouldOnlyJoinInAllowedGroups) {
      return true;
    }

    const allowedGroups = config.allowedGroupIds || [];
    const currentGroupId = ctx?.chat?.id.toString();

    if (!allowedGroups.includes(currentGroupId)) {
      elizaLogger.info(`Unauthorized group detected: ${currentGroupId}`);
      try {
        await ctx.reply("Not authorized. Leaving.");
        await ctx.leaveChat();
      } catch (error) {
        elizaLogger.error(`Error leaving unauthorized group ${currentGroupId}:`, error);
      }
      return false;
    }

    return true;
  }

  private setupMessageHandlers(): void {
    elizaLogger.log("Setting up message handler...");

    this.bot.on(message("new_chat_members"), async (ctx) => {
      try {
        const newMembers = ctx.message.new_chat_members;
        const isBotAdded = newMembers.some((member) => member.id === ctx.botInfo.id);

        if (isBotAdded && !(await this.isGroupAuthorized(ctx))) {
          return;
        }
      } catch (error) {
        elizaLogger.error("Error handling new chat members:", error);
      }
    });

    this.bot.on("message", async (ctx) => {
      try {
        // Check group authorization first
        if (!(await this.isGroupAuthorized(ctx))) {
          return;
        }

        await this.messageManager.handleMessage(ctx);
      } catch (error) {
        elizaLogger.error("❌ Error handling message:", error);
        // Don't try to reply if we've left the group or been kicked
        if (error?.response?.error_code !== 403) {
          try {
            await ctx.reply("An error occurred while processing your message.");
          } catch (replyError) {
            elizaLogger.error("Failed to send error message:", replyError);
          }
        }
      }
    });

    this.bot.catch((err, ctx) => {
      elizaLogger.error(`❌ Telegram Error for ${ctx.updateType}:`, err);
    });
  }

  private setupShutdownHandlers(): void {
    const shutdownHandler = async (signal: string) => {
      elizaLogger.log(`⚠️ Received ${signal}. Shutting down Telegram bot gracefully...`);
      try {
        await this.stop();
        elizaLogger.log("🛑 Telegram bot stopped gracefully");
      } catch (error) {
        elizaLogger.error("❌ Error during Telegram bot shutdown:", error);
        throw error;
      }
    };

    process.once("SIGINT", () => shutdownHandler("SIGINT"));
    process.once("SIGTERM", () => shutdownHandler("SIGTERM"));
    process.once("SIGHUP", () => shutdownHandler("SIGHUP"));
  }

  public async stop(): Promise<void> {
    elizaLogger.log("Stopping Telegram bot...");
    //await
    this.bot.stop();
    elizaLogger.log("Telegram bot stopped");
  }
}
