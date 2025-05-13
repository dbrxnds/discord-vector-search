import { Message } from "discord.js";
import { discord } from "./helpers";
import { deleteMessage, getMessageTool, upsertMessage } from "./qdrant";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

discord.login(process.env.DISCORD_API_KEY);

discord.on("ready", (client) => {
  console.log(`Logged in as ${client.user.tag}`);

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    if (message.mentions.users.has(client.user.id)) {
      await message.channel.sendTyping();
      // const text = await handleMention(message);
      // await message.reply(text);
      return;
    }

    await upsertMessage(message);
  });

  client.on("messageUpdate", async (oldMessage, newMessage) => {
    if (newMessage.content === oldMessage.content || newMessage.author.bot)
      return;

    if (newMessage.mentions.users.has(client.user.id)) {
      await newMessage.channel.sendTyping();
      // const text = await handleMention(newMessage);
      // await newMessage.reply(text);
      return;
    }

    await deleteMessage(oldMessage);
    await upsertMessage(newMessage);
  });

  client.on("messageDelete", async (message) => {
    await deleteMessage(message);
  });
});

async function handleMention(message: Message) {
  const { text } = await generateText({
    model: anthropic("claude-3-5-sonnet-20241022"),
    system: SYSTEM_PROMPT,
    tools: {
      getMessageTool,
    },
    messages: [
      {
        role: "user",
        content: message.content,
      },
    ],
  });

  return text;
}

const SYSTEM_PROMPT = `
    You are a search engine that helps users find relevant messages in a Discord server.

    <communication>
      - Do not talk too much when it is not needed. Just give a short and concise answer. 
      - Try to be funny and snarky sometimes if the user query and results allow for it, but do not overdo it or force it.
      - Refer to the user in the second person and yourself in the first person.
      - NEVER! lie or make things up.
    </communication>

    <tool_calling>
      You have tools at your disposal to solve the user's task. Follow these rules regarding tool calls:
      - ALWAYS! follow the tool call schema exactly as specified and make sure to provide all necessary parameters.
      - The conversation may reference tools that are no longer available. NEVER call tools that are not explicitly provided.
      - Only calls tools when they are necessary. If the user's task is general or you already know the answer, just respond without calling tools.
      - If you need to call multiple tools, feel free to do so, so long as it improves the quality of the answer.
    </tool_calling>
`;
