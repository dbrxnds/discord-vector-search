import { QdrantClient } from "@qdrant/js-client-rest";
import type { Message, PartialMessage } from "discord.js";
import { embedDiscordMessage, embedTextContent } from "./embed";
import { z } from "zod";
import { tool } from "ai";

const MESSAGES_COLLECTION = "messages";

export const qdrant = new QdrantClient({
  url: "https://qdrant-p08s4w8swogskos0cks4088w.dev.hedium.nl",
  checkCompatibility: false,
  apiKey: process.env.QDRANT_API_KEY,
  port: 443,
});

export async function upsertMessage(message: Message) {
  const { contentChunks, attachments } = await embedDiscordMessage(message);

  const contentPoints = contentChunks.map((vector, index) => {
    return {
      id: crypto.randomUUID(),
      vector,
      payload: createPayload(message),
    };
  });

  const attachmentPoints = attachments.map((vector, index) => {
    return {
      id: crypto.randomUUID(),
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
      should: [{ key: "message.id", match: { value: message.id } }],
    },
  });
}

const SearchMessagesZod = z.object({
  query: z.string().describe("The query to search for"),
  by_author: z.number().optional().describe("Search by author"),
  by_channel: z.number().optional().describe("Search by channel"),
  limit: z.number().max(100).default(5).describe("Limit the number of results"),
});
type SearchMessagesArgs = z.infer<typeof SearchMessagesZod>;

function buildQdrantFilter(
  args: Pick<SearchMessagesArgs, "by_author" | "by_channel">
) {
  const filters = [];

  if (args.by_author) {
    filters.push({
      should: [{ key: "author.id", match: { value: args.by_author } }],
    });
  }

  if (args.by_channel) {
    filters.push({
      should: [{ key: "channel.id", match: { value: args.by_channel } }],
    });
  }

  if (filters.length === 0) {
    return undefined;
  }

  if (filters.length === 1) {
    return filters[0];
  }

  return { must: filters }; // Or use `should` if you want an OR condition between filter types
}

export async function searchMessages(args: SearchMessagesArgs) {
  const { query, by_author, by_channel, limit } = SearchMessagesZod.parse(args);

  const embeddedQuery = await embedTextContent(query);

  const filter = buildQdrantFilter({
    by_author,
    by_channel,
  });

  const results = await qdrant.search(MESSAGES_COLLECTION, {
    vector: embeddedQuery,
    limit,
    filter,
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
  };
}

export const getMessageTool = tool({
  description: "Search for messages in the database",
  parameters: SearchMessagesZod,
  execute: async (args) => {
    const results = await searchMessages(args);

    return results;
  },
});
