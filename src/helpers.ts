import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { Client, IntentsBitField } from "discord.js";

export const AWS_CREDENTIALS = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
};

export const bedrock = new BedrockRuntimeClient({
  region: "eu-central-1",
  credentials: AWS_CREDENTIALS,
});

export const discord = new Client({
  intents: [
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
  ],
});
