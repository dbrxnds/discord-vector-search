import { qdrant } from "./qdrant";
import { embedImage, embedTextContent } from "./embed";
import { chunk } from "llm-chunk";
import { discord } from "./helpers";
import { ChannelType, Message, TextChannel } from "discord.js";

const CHANNEL_ID = "1136331809555230730";
const INITIAL_MESSAGE_ID = undefined; // "1164573736737968208";

if (true) {
  await qdrant.deleteCollection("messages");
}

const { collections } = await qdrant.getCollections();
if (!collections.some((c) => c.name === "messages")) {
  await qdrant.createCollection("messages", {
    vectors: {
      size: 1024,
      distance: "Cosine",
    },
    hnsw_config: {
      payload_m: 128,
    },
  });
}

discord.on("ready", async () => {
  const guild = await discord.guilds.fetch("597442427158003723");
  const channel = await guild.channels.fetch(CHANNEL_ID);

  if (channel?.type === ChannelType.GuildText) {
    const messages = await fetchAllMessages(channel, INITIAL_MESSAGE_ID);
    await processMessages(messages);
    throw new Error(`Done processing ${guild.name}`);
  }

  throw new Error("Channel not found");
});

discord.login(process.env.DISCORD_API_KEY);

async function processMessages(messages: Array<Message<true>>) {
  for (const [index, message] of messages.entries()) {
    console.log(
      `[${index + 1}/${messages.length}] Processing message ${message.id}`
    );

    const attachmentPoints = [];

    for (const attachment of message.attachments
      .filter((a) => a.contentType!.startsWith("image/"))
      .values()) {
      const embedding = await embedImage(attachment.url);

      attachmentPoints.push({
        id: crypto.randomUUID(),
        vector: embedding,
        payload: {
          channel: {
            id: message.channel.id,
          },
          message: {
            id: message.id,
            content: message.content,
          },
          author: {
            id: message.author.id,
            name: message.author.displayName,
          },
        },
      });
    }

    const contentChunks = chunk(message.content, {
      splitter: "sentence",
    }).filter((chunk) => chunk.length > 0);

    const contentPoints = [];
    for (const [index, chunk] of contentChunks.entries()) {
      const embedding = await embedTextContent(chunk);

      contentPoints.push({
        id: crypto.randomUUID(),
        vector: embedding,
        payload: {
          channel: {
            id: message.channel.id,
          },
          message: {
            id: message.id,
            content: message.content,
          },
          author: {
            id: message.author.id,
            name: message.author.displayName,
          },
        },
      });
    }

    await qdrant
      .upsert("messages", {
        points: [...contentPoints, ...attachmentPoints],
      })
      .catch((e) => console.log(e.data));

    console.log(`[${index + 1}/${messages.length}] Processed message`);
  }
}

async function fetchAllMessages(
  channel: TextChannel,
  initialMessageId?: string
) {
  const messages: Array<Message<true>> = [];

  // Create message pointer
  let message = await channel!.messages
    .fetch({ limit: 1, after: initialMessageId })
    .then((messagePage) => (messagePage.size === 1 ? messagePage.at(0) : null));

  while (message) {
    await channel.messages
      .fetch({ limit: 100, before: message.id })
      .then((messagePage) => {
        messagePage.forEach((msg) => messages.push(msg));

        // Update our message pointer to be the last message on the page of messages
        message =
          0 < messagePage.size ? messagePage.at(messagePage.size - 1) : null;
      });
  }

  return messages;
}
