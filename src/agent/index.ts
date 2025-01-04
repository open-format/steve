import { PostgresDatabaseAdapter } from "@elizaos/adapter-postgres";
import { DirectClient } from "@elizaos/client-direct";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DiscordClientInterface } from "../clients/discord";

import {
  AgentRuntime,
  CacheManager,
  CacheStore,
  type Character,
  type Client,
  Clients,
  DbCacheAdapter,
  type IAgentRuntime,
  type ICacheManager,
  type IDatabaseAdapter,
  type IDatabaseCacheAdapter,
  ModelProviderName,
  defaultCharacter,
  elizaLogger,
  settings,
  stringToUuid,
  validateCharacterConfig,
} from "@elizaos/core";

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

export const wait = (minTime = 1000, maxTime = 3000) => {
  const waitTime = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
  return new Promise((resolve) => setTimeout(resolve, waitTime));
};

const logFetch = async (url: string, options: any) => {
  elizaLogger.debug(`Fetching ${url}`);
  // Disabled to avoid disclosure of sensitive information such as API keys
  // elizaLogger.debug(JSON.stringify(options, null, 2));
  return fetch(url, options);
};

function tryLoadFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (e) {
    return null;
  }
}

function isAllStrings(arr: unknown[]): boolean {
  return Array.isArray(arr) && arr.every((item) => typeof item === "string");
}

export async function loadCharacters(charactersArg: string): Promise<Character[]> {
  const characterPaths = charactersArg?.split(",").map((filePath) => filePath.trim());
  const loadedCharacters = [];

  if (characterPaths?.length > 0) {
    for (const characterPath of characterPaths) {
      let content = null;
      let resolvedPath = "";

      // Try different path resolutions in order
      const pathsToTry = [
        characterPath, // exact path as specified
        path.resolve(process.cwd(), characterPath), // relative to cwd
        path.resolve(process.cwd(), "agent", characterPath), // Add this
        path.resolve(__dirname, characterPath), // relative to current script
        path.resolve(__dirname, "characters", path.basename(characterPath)), // relative to agent/characters
        path.resolve(__dirname, "../characters", path.basename(characterPath)), // relative to characters dir from agent
        path.resolve(__dirname, "../../characters", path.basename(characterPath)), // relative to project root characters dir
      ];

      elizaLogger.info(
        "Trying paths:",
        pathsToTry.map((p) => ({
          path: p,
          exists: fs.existsSync(p),
        }))
      );

      for (const tryPath of pathsToTry) {
        content = tryLoadFile(tryPath);
        if (content !== null) {
          resolvedPath = tryPath;
          break;
        }
      }

      if (content === null) {
        elizaLogger.error(
          `Error loading character from ${characterPath}: File not found in any of the expected locations`
        );
        elizaLogger.error("Tried the following paths:");
        pathsToTry.forEach((p) => elizaLogger.error(` - ${p}`));
        process.exit(1);
      }

      try {
        const character = JSON.parse(content);
        validateCharacterConfig(character);

        // .id isn't really valid
        const characterId = character.id || character.name;
        const characterPrefix = `CHARACTER.${characterId.toUpperCase().replace(/ /g, "_")}.`;

        const characterSettings = Object.entries(process.env)
          .filter(([key]) => key.startsWith(characterPrefix))
          .reduce((settings, [key, value]) => {
            const settingKey = key.slice(characterPrefix.length);
            return { ...settings, [settingKey]: value };
          }, {});

        if (Object.keys(characterSettings).length > 0) {
          character.settings = character.settings || {};
          character.settings.secrets = {
            ...characterSettings,
            ...character.settings.secrets,
          };
        }

        // Check if plugins are loaded correctly
        if (character.plugins) {
          console.log("Plugins are: ", character.plugins);
          const importedPlugins = await Promise.all(
            character.plugins.map(async (pluginName) => {
              console.log("Importing plugin: ", pluginName);
              try {
                // Handle local package imports

                const importedPlugin = await import(`../plugins/${pluginName}/index.ts`);
                console.log("Imported local plugin: ", importedPlugin);
                return importedPlugin.scoringPlugin || importedPlugin;
              } catch (error) {
                elizaLogger.error(`Error importing plugin ${pluginName}:`, error);
                return null;
              }
            })
          );

          // Filter out any failed imports and log a warning
          character.plugins = importedPlugins.filter((plugin) => plugin !== null);

          if (character.plugins.length === 0) {
            elizaLogger.warn("No plugins could be loaded");
          }

          loadedCharacters.push(character);
          elizaLogger.info(`Successfully loaded character from: ${resolvedPath}`);
        }
      } catch (e) {
        elizaLogger.error(`Error parsing character from ${resolvedPath}: ${e}`);
        process.exit(1);
      }
    }
  }

  if (loadedCharacters.length === 0) {
    elizaLogger.info("No characters found, using default character");
    loadedCharacters.push(defaultCharacter);
  }

  return loadedCharacters;
}

export function getTokenForProvider(provider: ModelProviderName, character: Character): string {
  switch (provider) {
    case ModelProviderName.OPENAI:
      return character.settings?.secrets?.OPENAI_API_KEY || settings.OPENAI_API_KEY;
    case ModelProviderName.ANTHROPIC:
      return (
        character.settings?.secrets?.ANTHROPIC_API_KEY ||
        character.settings?.secrets?.CLAUDE_API_KEY ||
        settings.ANTHROPIC_API_KEY ||
        settings.CLAUDE_API_KEY
      );
    default:
      const errorMessage = `Failed to get token - unsupported model provider: ${provider}`;
      elizaLogger.error(errorMessage);
      throw new Error(errorMessage);
  }
}

function initializeDatabase() {
  if (process.env.POSTGRES_URL) {
    elizaLogger.info("Initializing PostgreSQL connection...");
    const db = new PostgresDatabaseAdapter({
      connectionString: process.env.POSTGRES_URL,
      parseInputs: true,
    });

    // Test the connection
    db.init()
      .then(() => {
        elizaLogger.success("Successfully connected to PostgreSQL database");
      })
      .catch((error) => {
        elizaLogger.error("Failed to connect to PostgreSQL:", error);
      });

    return db;
  }
}

// also adds plugins from character file into the runtime
export async function initializeClients(character: Character, runtime: IAgentRuntime) {
  // each client can only register once
  // and if we want two we can explicitly support it
  const clients: Record<string, any> = {};
  const clientTypes: string[] = character.clients?.map((str) => str.toLowerCase()) || [];
  elizaLogger.log("initializeClients", clientTypes, "for", character.name);

  if (clientTypes.includes(Clients.DISCORD)) {
    const discordClient = await DiscordClientInterface.start(runtime);
    if (discordClient) clients.discord = discordClient;
  }

  elizaLogger.log("client keys", Object.keys(clients));

  function determineClientType(client: Client): string {
    // Check if client has a direct type identifier
    if ("type" in client) {
      return (client as any).type;
    }

    // Check constructor name
    const constructorName = client.constructor?.name;
    if (constructorName && !constructorName.includes("Object")) {
      return constructorName.toLowerCase().replace("client", "");
    }

    // Fallback: Generate a unique identifier
    return `client_${Date.now()}`;
  }

  if (character.plugins?.length > 0) {
    for (const plugin of character.plugins) {
      if (plugin.clients) {
        for (const client of plugin.clients) {
          const startedClient = await client.start(runtime);
          const clientType = determineClientType(client);
          elizaLogger.debug(`Initializing client of type: ${clientType}`);
          clients[clientType] = startedClient;
        }
      }
    }
  }

  return clients;
}

export async function createAgent(
  character: Character,
  db: IDatabaseAdapter,
  cache: ICacheManager,
  token: string
): Promise<AgentRuntime> {
  elizaLogger.success(elizaLogger.successesTitle, "Creating runtime for character", character.name);

  return new AgentRuntime({
    databaseAdapter: db,
    token,
    modelProvider: character.modelProvider,
    evaluators: [],
    character,
    // character.plugins are handled when clients are added
    plugins: [],
    providers: [],
    actions: [],
    services: [],
    managers: [],
    cacheManager: cache,
    fetch: logFetch,
  });
}

function initializeDbCache(character: Character, db: IDatabaseCacheAdapter) {
  const cache = new CacheManager(new DbCacheAdapter(db, character.id));
  return cache;
}

function initializeCache(cacheStore: string, character: Character, baseDir?: string, db?: IDatabaseCacheAdapter) {
  switch (cacheStore) {
    case CacheStore.DATABASE:
      if (db) {
        elizaLogger.info("Using Database Cache...");
        return initializeDbCache(character, db);
      }
      throw new Error("Database adapter is not provided for CacheStore.Database.");
    default:
      throw new Error(`Invalid cache store: ${cacheStore} or required configuration missing.`);
  }
}

async function startAgent(character: Character, directClient: DirectClient): Promise<AgentRuntime> {
  let db: (IDatabaseAdapter & IDatabaseCacheAdapter) | undefined;
  try {
    // Ensure character.id is always a string
    character.id = character.id || stringToUuid(character.name || "default");
    character.username = character.username || character.name;

    const token = getTokenForProvider(character.modelProvider, character);
    const dataDir = path.join(__dirname, "../data");

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    db = initializeDatabase(dataDir) as IDatabaseAdapter & IDatabaseCacheAdapter;

    await db.init();

    const cache = initializeCache(process.env.CACHE_STORE ?? CacheStore.DATABASE, character, "", db); // "" should be replaced with dir for file system caching. THOUGHTS: might probably make this into an env
    const runtime: AgentRuntime = await createAgent(character, db, cache, token);

    // start services/plugins/process knowledge
    await runtime.initialize();

    // start assigned clients
    runtime.clients = await initializeClients(character, runtime);

    // add to container
    directClient.registerAgent(runtime);

    // report to console
    elizaLogger.debug(`Started ${character.name} as ${runtime.agentId}`);

    return runtime;
  } catch (error) {
    elizaLogger.error(`Error starting agent for character ${character.name}:`, error);
    if (db) {
      await db.close();
    }
    throw error;
  }
}

const startAgents = async () => {
  const directClient = new DirectClient();

  // Load the default character from JSON file
  const characterPath = path.join(__dirname, "../characters/default.json");
  const characters = await loadCharacters(characterPath);

  try {
    // Start single agent
    await startAgent(characters[0], directClient);
  } catch (error) {
    elizaLogger.error("Error starting agent:", error);
  }
};

startAgents().catch((error) => {
  elizaLogger.error("Unhandled error in startAgents:", error);
  process.exit(1);
});
