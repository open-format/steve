# steve

<img src="https://avatars.githubusercontent.com/u/41952984?v=4" alt="steve" width="200" style="border-radius: 12px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);">

hi, I'm steve. I'm an AI agent that ranks, scores and rewards contributions to a Discord server.

## Prerequisites

### Node.js 23.3.0

```bash
# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash

# Install Node.js 23.3.0
nvm install 23.3.0

# Use Node.js 23.3.0
nvm use 23.3.0
```

### pnpm

```bash
# Install pnpm
npm install -g pnpm

# Verify installation
pnpm --version
```

### Postgres Database

1. Create a [Supabase](https://supabase.com) project (recommended)
2. Enable the `pg_vector` extension in the database settings of your supabase project

### Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to the "Bot" section and create a bot
4. Enable these bot permissions:

   - Send Messages
   - Send Messages in Threads
   - Embed Links
   - Attach Files
   - Read Message History
   - Add Reactions
   - Connect (Voice)
   - Speak (Voice)
   - Use Voice Activity
   - Priority Speaker
   - Use Application Commands

5. Under "Privileged Gateway Intents", enable:

   - Message Content Intent
   - Server Members Intent
   - Presence Intent

6. Go to OAuth2 > URL Generator:
   - Select scopes: `bot`, `applications.commands`
   - Select the permissions listed above
   - Use the generated URL to invite the bot to your server
7. Save your bot token for later use

## Local Development

1. Copy the `.env.example` file to `.env` and fill in the values

```bash
cp .env.example .env
```

2. Install dependencies

```bash
pnpm install
```

3. Run the bot

```bash
pnpm run dev
```

## Environment Variables

| Variable                 | Required | Description                                                                    |
| ------------------------ | -------- | ------------------------------------------------------------------------------ |
| `DATABASE_URL`           | ✅       | Connection URL for your PostgreSQL database                                    |
| `POSTGRES_POOL_MIN`      | ❌       | Minimum number of connections in the database pool (recommended: 2)            |
| `POSTGRES_POOL_MAX`      | ❌       | Maximum number of connections in the database pool (recommended: 10)           |
| `OPENAI_API_KEY`         | ⚡       | OpenAI API key starting with 'sk-'. Required if using OpenAI as model provider |
| `ANTHROPIC_API_KEY`      | ⚡       | Anthropic API key. Required if using Anthropic/Claude as model provider        |
| `DISCORD_APPLICATION_ID` | ✅       | Your Discord application ID from the Developer Portal                          |
| `DISCORD_API_TOKEN`      | ✅       | Your Discord bot token from the Developer Portal                               |

> ✅ = Required  
> ⚡ = Required (one model provider must be chosen)

### Model Provider Selection

The model provider can be configured in [`src/characters/default.json`](src/characters/default.json):

```json
{
  "modelProvider": "openai" // or "anthropic"
}
```

## Scoring Rules

Steve uses a comprehensive scoring system defined in `src/config/scoring-rules.json` to evaluate and rank contributions. The scoring system consists of two main components:

### Quality Score

Quality scoring evaluates the content of messages based on:

- **Message Length** (20% weight)
  - Minimum: 5 characters
  - Ideal: 100 characters
- **Unique Words** (20% weight)
  - Minimum: 3 words
  - Ideal: 20 words
- **Relevance** (30% weight)
  - Channel topic matching
  - Keyword matching
- **Engagement** (30% weight)
  - Reactions received
  - Replies generated

### Trust Score

Trust scoring evaluates the contributor based on:

- **Account Age** (20% weight)
  - Minimum: 1 day
  - Ideal: 30 days
- **Previous Contributions** (30% weight)
  - Quality average
  - Quantity of contributions
- **Community Standing** (30% weight)
  - Server roles
  - Reputation score
- **Report History** (20% weight)
  - Rule violations
  - Warnings received

### Minimum Requirements

For a message to be scored, it must meet these basic conditions:

- Minimum length: 1 character
- Minimum reactions: 2
- Minimum quality score: 0
- Minimum trust score: 0

You can customize these scoring rules by modifying the `src/config/scoring-rules.json` file. The schema for this configuration is defined in `src/config/scoring-rules.schema.ts`.

### Scoring Actions

When a message meets the scoring conditions, you can configure custom actions to be executed. These actions are defined in TypeScript files under `src/clients/discord/actions/`.

Here's an example of a scoring action that sends a cat fact when conditions are met:

```typescript
// src/clients/discord/actions/scoring_action.ts
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
      `You met the scoring conditions! Here's a cat fact: ${catFact}`,
      message.id,
      []
    );
  },
};
```

To create your own scoring action:

1. Create a new file in `src/clients/discord/actions/`
2. Define your action using the `ScoringAction` interface:
   ```typescript
   interface ScoringAction {
     name: string;
     handler: (message: Message, meetsConditions: boolean) => Promise<void>;
   }
   ```
3. Export your action as the default export
4. The handler will be called automatically when a message meets the scoring conditions

Your action can do anything you want - send messages, add reactions, update a database, or integrate with external services.

## Character Customization

You can customize the AI character by modifying `src/characters/default.json`. The character file supports:

- `name`: Character's display name
- `bio`: Array of biographical statements
- `lore`: Array of backstory elements
- `topics`: Subjects the character is knowledgeable about
- `style`: Behavior patterns for different contexts
- `messageExamples`: Sample conversations
- `postExamples`: Sample social media posts
- `adjectives`: Character traits

For detailed documentation on character configuration, see the [Character Files documentation](https://elizaos.github.io/eliza/docs/core/characterfile/).

## Deployment

### Using Fly.io (Recommended)

1. Install the Fly CLI:

```bash
# macOS
brew install flyctl

# Windows
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

# Linux
curl -L https://fly.io/install.sh | sh
```

2. Sign up and log in:

```bash
fly auth signup
# or if you already have an account
fly auth login
```

3. Launch your application:

```bash
fly launch
```

This will:

- Create a `fly.toml` file
- Create and configure a Fly.io app

4. Set your environment variables:

```bash
fly secrets set DISCORD_API_TOKEN="your-token"
fly secrets set DISCORD_APPLICATION_ID="your-app-id"
fly secrets set OPENAI_API_KEY="your-key"
fly secrets set DATABASE_URL="your-postgres-url"
# Set any other required environment variables
```

5. Deploy your application:

```bash
fly deploy
```

Your bot should now be running in production! You can monitor its status with:

```bash
fly status
fly logs
```
