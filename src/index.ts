import { discord } from "./helpers";
import { handleSearch } from "./ai";
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

      const [, searchResult] = await Promise.all([
        interaction.deferReply(),
        handleSearch(query),
      ]);

      if (searchResult.isErr()) {
        const errorMessage =
          searchResult.error instanceof Error
            ? searchResult.error.message
            : "An unknown error occurred";

        await interaction.editReply(`Error: ${errorMessage}`);
        return;
      }

      await interaction.editReply(searchResult.value.text);
    }
  });

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    // await upsertMessage(message);
  });
});
