import { QdrantClient } from "@qdrant/js-client-rest";
import type { Message, PartialMessage } from "discord.js";
import { embedDiscordMessage, embedTextContent } from "./embed";
import { z } from "zod";
import { tool } from "ai";

const MESSAGES_COLLECTION = "messages";

const qdrant = new QdrantClient({
  url: "https://qdrant-p08s4w8swogskos0cks4088w.dev.hedium.nl:6333",
  apiKey: process.env.QDRANT_API_KEY,
});

export async function upsertMessage(message: Message) {
  const { contentChunks, attachments } = await embedDiscordMessage(message);

  const contentPoints = contentChunks.map((vector, index) => {
    return {
      id: `${message.id}-text-${index}`,
      vector,
      payload: createPayload(message),
    };
  });

  const attachmentPoints = attachments.map((vector, index) => {
    return {
      id: `${message.id}-attachment-${index}`,
      vector,
      payload: createPayload(message),
    };
  });

  await qdrant.upsert(MESSAGES_COLLECTION, {
    points: [...contentPoints, ...attachmentPoints],
  });
}

export async function deleteMessage(message: PartialMessage | Message) {
  await qdrant.delete(MESSAGES_COLLECTION, {
    filter: {
      should: [{ key: "id", match: { value: message.id } }],
    },
  });
}

const SearchMessagesZod = z.object({
  query: z.string(),
  by_authors: z.array(z.string()).optional(),
  limit: z.number().max(100).default(5),
});
type SearchMessagesArgs = z.infer<typeof SearchMessagesZod>;

export async function searchMessages(args: SearchMessagesArgs) {
  const { query, by_authors, limit } = SearchMessagesZod.parse(args);

  const embeddedQuery = await embedTextContent(query);

  const results = await qdrant.search(MESSAGES_COLLECTION, {
    vector: embeddedQuery,
    limit,
    filter: by_authors && {
      should: by_authors.map((author) => ({
        key: "author.id",
        match: { value: author },
      })),
    },
  });

  return results.map((result) => {
    return {
      ...result,
      payload: result.payload as MessagePayload,
    };
  });
}

type MessagePayload = ReturnType<typeof createPayload>;
function createPayload(message: Message) {
  return {
    message: {
      id: message.id,
      content: message.content,
    },
    author: {
      id: message.author.id,
      name: message.author.displayName,
    },
    content: message.content,
  };
}

export const getMessageTool = tool({
  description: "Search for messages in the database",
  parameters: SearchMessagesZod,
  execute: async ({ query, by_authors, limit }) => {
    const results = await searchMessages({ query, by_authors, limit });

    return results;
  },
});
