import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import type { Message } from "discord.js";
import { chunk } from "llm-chunk";

const bedrock = new BedrockRuntimeClient({
  region: "eu-central-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function embedDiscordMessage(message: Message) {
  const embeddedAttachmentsPromises = message.attachments.map((attachment) =>
    embedImage(attachment.url)
  );

  const contentChunksPromises = chunk(message.content, {
    splitter: "sentence",
  }).map(async (chunk) => await embedTextContent(chunk));

  const [contentChunks, embeddedAttachments] = await Promise.all([
    Promise.all(contentChunksPromises),
    Promise.all(embeddedAttachmentsPromises),
  ]);

  return {
    contentChunks,
    attachments: embeddedAttachments,
  };
}

const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25mb

export async function embedImage(url: string) {
  const base64String = await fetch(url)
    .then((res) => res.arrayBuffer())
    .then((buffer) => Buffer.from(buffer).toString("base64"));

  if (base64String.length > MAX_ATTACHMENT_SIZE) {
    return null;
  }

  // titan image embed model
  const command = new InvokeModelCommand({
    modelId: "amazon.titan-embed-image-v1",
    body: JSON.stringify({
      inputImage: base64String,
    }),
  });

  try {
    const embedding = await bedrock
      .send(command)
      .then((res) => JSON.parse(res.body.transformToString()).embedding);

    return embedding;
  } catch (e) {
    console.error(url);
    throw e;
  }
}

export async function embedTextContent(content: string) {
  // Do embed
  const command = new InvokeModelCommand({
    modelId: "amazon.titan-embed-image-v1",
    body: JSON.stringify({
      inputText: content,
    }),
  });

  const embedding = await bedrock
    .send(command)
    .then((res) => JSON.parse(res.body.transformToString()).embedding);

  return embedding;
}
