import { discord } from "./helpers";
import { handleMention } from "./ai";
import { ApplicationCommandOptionType } from "discord.js";

discord.login(process.env.DISCORD_API_KEY);

const KRIJN_GUILD_ID = "597442427158003723";

discord.on("ready", async (client) => {
  console.log(`Logged in as ${client.user.tag}`);

  const guild = await discord.guilds.fetch(KRIJN_GUILD_ID);

  await guild.commands.create({
    name: "search",
    description: "Search for messages in the server",
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "query",
        description: "The query to search for",
        required: true,
      },
    ],
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === "search") {
      const query = interaction.options.getString("query", true);

      const [, text] = await Promise.all([
        interaction.deferReply(),
        handleMention(query),
      ]);

      await interaction.editReply(text);
    }
  });

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    // await upsertMessage(message);
  });
});
