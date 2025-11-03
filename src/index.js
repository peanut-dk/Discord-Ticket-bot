'use strict';

require('dotenv').config();

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');

const {
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
  DISCORD_GUILD_ID,
  STAFF_ROLE_ID,
  TICKET_CATEGORY_ID,
  CKPK_CATEGORY_ID,
  CKPK_STAFF_ROLE_ID,
  GENERAL_CATEGORY_ID,
  GENERAL_STAFF_ROLE_ID,
  KOMPENSATION_CATEGORY_ID,
  KOMPENSATION_STAFF_ROLE_ID,
  FIRMA_CATEGORY_ID,
  FIRMA_STAFF_ROLE_ID,
  UNBAN_CATEGORY_ID,
  UNBAN_STAFF_ROLE_ID,
  BANDE_CATEGORY_ID,
  BANDE_STAFF_ROLE_ID
} = process.env;

const REQUIRED_ENV = {
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
  DISCORD_GUILD_ID,
  STAFF_ROLE_ID,
  CKPK_CATEGORY_ID,
  CKPK_STAFF_ROLE_ID,
  GENERAL_CATEGORY_ID,
  GENERAL_STAFF_ROLE_ID,
  KOMPENSATION_CATEGORY_ID,
  KOMPENSATION_STAFF_ROLE_ID,
  FIRMA_CATEGORY_ID,
  FIRMA_STAFF_ROLE_ID,
  UNBAN_CATEGORY_ID,
  UNBAN_STAFF_ROLE_ID,
  BANDE_CATEGORY_ID,
  BANDE_STAFF_ROLE_ID
};

const missingEnv = Object.entries(REQUIRED_ENV)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingEnv.length > 0) {
  console.error(
    `Missing required environment variables: ${missingEnv.join(', ')}. ` +
      'Check your .env file.'
  );
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

const TICKET_CHANNEL_PREFIX = 'ticket-';
const CREATE_TICKET_BUTTON_ID = 'division-ticket-close';
const CATEGORY_SELECT_ID = 'division-ticket-category-select';

const TICKET_CATEGORIES = [
  {
    id: 'ckpk',
    label: 'CK/PK',
    emoji: '⚔️',
    description: 'Rapportér karakterdrab eller problematiske situationer omkring CK/PK.',
    categoryId: CKPK_CATEGORY_ID,
    staffRoleId: CKPK_STAFF_ROLE_ID ?? STAFF_ROLE_ID
  },
  {
    id: 'general',
    label: 'General',
    emoji: '💬',
    description: 'Generelle spørgsmål om serveren, tekniske issues eller hjælp til systemer.',
    categoryId: GENERAL_CATEGORY_ID,
    staffRoleId: GENERAL_STAFF_ROLE_ID ?? STAFF_ROLE_ID
  },
  {
    id: 'kompensation',
    label: 'Kompensation',
    emoji: '💰',
    description: 'Ansøg om kompensation for tabte genstande, køretøjer eller økonomi.',
    categoryId: KOMPENSATION_CATEGORY_ID,
    staffRoleId: KOMPENSATION_STAFF_ROLE_ID ?? STAFF_ROLE_ID
  },
  {
    id: 'firma',
    label: 'Firma',
    emoji: '🏢',
    description: 'Firma- og virksomhedsrelaterede henvendelser, samarbejde eller spons.',
    categoryId: FIRMA_CATEGORY_ID,
    staffRoleId: FIRMA_STAFF_ROLE_ID ?? STAFF_ROLE_ID
  },
  {
    id: 'unban',
    label: 'Unban',
    emoji: '🔓',
    description: 'Anmod om genåbning af en ban og forklar din side af sagen.',
    categoryId: UNBAN_CATEGORY_ID,
    staffRoleId: UNBAN_STAFF_ROLE_ID ?? STAFF_ROLE_ID
  },
  {
    id: 'bande',
    label: 'Bande',
    emoji: '🛡️',
    description: 'Bande-ansøgninger, ændringer eller administrative bande-henvendelser.',
    categoryId: BANDE_CATEGORY_ID,
    staffRoleId: BANDE_STAFF_ROLE_ID ?? STAFF_ROLE_ID
  }
];

const commands = [
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket værktøjer')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Opret en ny support-ticket')
        .addStringOption((option) =>
          option
            .setName('kategori')
            .setDescription('Ticket kategori')
            .addChoices(
              ...TICKET_CATEGORIES.map((cat) => ({
                name: `${cat.emoji} ${cat.label}`,
                value: cat.id
              }))
            )
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName('emne')
            .setDescription('Kort beskrivelse af problemet')
            .setMinLength(3)
            .setMaxLength(140)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('close')
        .setDescription('Luk den aktive ticket')
    )
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Tilføj en bruger til den aktive ticket')
        .addUserOption((option) =>
          option
            .setName('bruger')
            .setDescription('Bruger der skal tilføjes')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('panel')
        .setDescription('Send ticket-panelet med kategorier')
        .addChannelOption((option) =>
          option
            .setName('kanal')
            .setDescription('Kanal hvor panelet skal sendes')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .toJSON()
];

async function registerCommands() {
  try {
    await rest.put(
      Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID),
      { body: commands }
    );
    console.log('Slash commands registered.');
  } catch (error) {
    console.error('Failed to register slash commands:', error);
  }
}

function getCategoryById(id) {
  return TICKET_CATEGORIES.find((cat) => cat.id === id) ?? null;
}

function buildTicketChannelName(user, category) {
  const safeName = user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bruger';
  const suffix = user.id.slice(-4);
  return `${TICKET_CHANNEL_PREFIX}${category.id}-${safeName}-${suffix}`;
}

function buildTicketEmbed(interaction, category, topic) {
  const lines = [
    `${category.emoji} **Kategori:** ${category.label}`,
    '',
    topic
      ? `**Emne:** ${topic}`
      : 'Beskriv venligst din henvendelse så detaljeret som muligt.'
  ].join('\n');

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Support Ticket')
    .setDescription(lines)
    .addFields({
      name: 'Bruger',
      value: `${interaction.user.tag} (${interaction.user.id})`
    })
    .setTimestamp();
}

async function ensureSingleTicket(interaction, category) {
  const existingChannel = interaction.guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildText &&
      channel.name.startsWith(TICKET_CHANNEL_PREFIX) &&
      channel.topic?.includes(interaction.user.id) &&
      channel.topic?.includes(`kategori: ${category.label}`)
  );

  if (existingChannel) {
    await interaction.reply({
      content: `Du har allerede en åben ticket i kategorien ${category.label}: ${existingChannel}`,
      ephemeral: true
    });
    return false;
  }

  return true;
}

function buildPermissionOverwrites(guild, ownerId, staffRoleId) {
  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionsBitField.Flags.ViewChannel]
    },
    {
      id: ownerId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.AttachFiles,
        PermissionsBitField.Flags.ReadMessageHistory
      ]
    }
  ];

  if (staffRoleId) {
    overwrites.push({
      id: staffRoleId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ManageChannels
      ]
    });
  }

  return overwrites;
}

async function createTicket(interaction, category, topic = null) {
  if (!(await ensureSingleTicket(interaction, category))) {
    return;
  }

  const guild = interaction.guild;
  const channelName = buildTicketChannelName(interaction.user, category);

  let parent = null;
  if (category.categoryId) {
    const cat = guild.channels.cache.get(category.categoryId) ?? null;
    if (cat && cat.type === ChannelType.GuildCategory) {
      parent = cat;
    } else if (cat) {
      console.warn(`Kategori ${category.categoryId} er ikke en gyldig Discord-kategori. Ignorerer.`);
    }
  }
  if (!parent && TICKET_CATEGORY_ID) {
    const fallback = guild.channels.cache.get(TICKET_CATEGORY_ID) ?? null;
    if (fallback && fallback.type === ChannelType.GuildCategory) {
      parent = fallback;
    } else if (fallback) {
      console.warn('TICKET_CATEGORY_ID peger ikke på en kategori. Ignorerer værdien.');
    }
  }

  try {
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      topic: `Ticket owner: ${interaction.user.tag} (${interaction.user.id}) | kategori: ${category.label}`,
      parent,
      permissionOverwrites: buildPermissionOverwrites(
        guild,
        interaction.user.id,
        category.staffRoleId ?? STAFF_ROLE_ID
      )
    });

    const closeButton = new ButtonBuilder()
      .setCustomId(CREATE_TICKET_BUTTON_ID)
      .setLabel('Luk ticket')
      .setStyle(ButtonStyle.Danger);

    const welcomeLines = [
      `${interaction.user}${STAFF_ROLE_ID ? ` <@&${STAFF_ROLE_ID}>` : ''}`,
      `${category.emoji} **${category.label}**`,
      'Velkommen til supporten! Beskriv dit problem så detaljeret som muligt.',
      'Når sagen er løst, kan du lukke ticketen med knappen nedenfor.'
    ];

    await channel.send({
      content: welcomeLines.join('\n'),
      embeds: [buildTicketEmbed(interaction, category, topic)],
      components: [new ActionRowBuilder().addComponents(closeButton)],
      allowedMentions: {
        users: [interaction.user.id],
        roles: STAFF_ROLE_ID ? [STAFF_ROLE_ID] : []
      }
    });

    await interaction.reply({
      content: `Din ticket (${category.label}) er oprettet: ${channel}`,
      ephemeral: true
    });
  } catch (error) {
    console.error('Kunne ikke oprette ticket:', error);
    await interaction.reply({
      content: 'Noget gik galt under oprettelsen af din ticket. Prøv igen senere.',
      ephemeral: true
    });
  }
}

function isTicketChannel(channel) {
  return (
    channel &&
    channel.type === ChannelType.GuildText &&
    channel.name.startsWith(TICKET_CHANNEL_PREFIX) &&
    channel.topic?.startsWith('Ticket owner:')
  );
}

function memberHasStaffAccess(member) {
  if (!member) {
    return false;
  }

  return (
    member.roles.cache.has(STAFF_ROLE_ID) ||
    member.permissions.has(PermissionsBitField.Flags.ManageChannels)
  );
}

function userCanCloseTicket(member, channel, userId) {
  const isOwner = channel.topic?.includes(userId);
  return isOwner || memberHasStaffAccess(member);
}

async function closeTicket(interaction) {
  const { channel } = interaction;

  if (!isTicketChannel(channel)) {
    await interaction.reply({
      content: 'Denne kommando kan kun bruges i en ticket.',
      ephemeral: true
    });
    return;
  }

  if (!userCanCloseTicket(interaction.member, channel, interaction.user.id)) {
    await interaction.reply({
      content: 'Du har ikke adgang til at lukke denne ticket.',
      ephemeral: true
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    await channel.send('Ticketen bliver lukket om 5 sekunder...');
    setTimeout(async () => {
      try {
        await channel.delete('Ticket lukket via command');
      } catch (error) {
        console.error('Kunne ikke slette ticket kanal:', error);
      }
    }, 5000);

    await interaction.editReply('Ticketen bliver lukket. Tak for din henvendelse!');
  } catch (error) {
    console.error('Kunne ikke lukke ticket:', error);
    await interaction.editReply('Der opstod en fejl under lukning af ticketen.');
  }
}

async function addMemberToTicket(interaction) {
  const { channel } = interaction;

  if (!isTicketChannel(channel)) {
    await interaction.reply({
      content: 'Denne kommando kan kun bruges i en ticket.',
      ephemeral: true
    });
    return;
  }

  if (!memberHasStaffAccess(interaction.member)) {
    await interaction.reply({
      content: 'Du skal have staff-adgang for at tilføje brugere til en ticket.',
      ephemeral: true
    });
    return;
  }

  const memberToAdd = interaction.options.getMember('bruger');

  if (!memberToAdd) {
    await interaction.reply({
      content: 'Kunne ikke finde den angivne bruger.',
      ephemeral: true
    });
    return;
  }

  const currentPermissions = channel.permissionsFor(memberToAdd);
  if (currentPermissions?.has(PermissionsBitField.Flags.ViewChannel)) {
    await interaction.reply({
      content: 'Denne bruger har allerede adgang til ticketen.',
      ephemeral: true
    });
    return;
  }

  try {
    await channel.permissionOverwrites.edit(memberToAdd.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true
    });

    await interaction.reply({
      content: `${memberToAdd} er tilføjet til ticketen.`,
      ephemeral: true
    });

    await channel.send(`${memberToAdd} blev tilføjet til ticketen af ${interaction.user}.`);
  } catch (error) {
    console.error('Kunne ikke tilføje medlem til ticket:', error);
    await interaction.reply({
      content: 'Der skete en fejl under tilføjelsen af brugeren til ticketen.',
      ephemeral: true
    });
  }
}

function buildPanelEmbed(interaction) {
  const embed = new EmbedBuilder()
    .setColor(0x6c5ce7)
    .setTitle('Opret en Ticket')
    .setDescription(
      'Vælg den kategori der passer bedst til dit behov. Klik på dropdown-menuen nedenfor.'
    )
    .setFooter({ text: `${interaction.guild.name} • Ticket System` })
    .setTimestamp();

  const fields = TICKET_CATEGORIES.map((category) => ({
    name: `${category.emoji} ${category.label}`,
    value: category.description,
    inline: false
  }));

  return embed.addFields(fields);
}

function buildCategorySelect() {
  const select = new StringSelectMenuBuilder()
    .setCustomId(CATEGORY_SELECT_ID)
    .setPlaceholder('Vælg en kategori...')
    .addOptions(
      TICKET_CATEGORIES.map((category) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(category.label)
          .setDescription(category.description.slice(0, 100))
          .setValue(category.id)
          .setEmoji(category.emoji)
      )
    );

  return new ActionRowBuilder().addComponents(select);
}

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName !== 'ticket') {
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'create') {
      const categoryId = interaction.options.getString('kategori') ?? 'general';
      const category = getCategoryById(categoryId) ?? getCategoryById('general');
      const topic = interaction.options.getString('emne') ?? null;
      await createTicket(interaction, category, topic);
      return;
    }

    if (subcommand === 'close') {
      await closeTicket(interaction);
      return;
    }

    if (subcommand === 'add') {
      await addMemberToTicket(interaction);
      return;
    }

    if (subcommand === 'panel') {
      const channel =
        interaction.options.getChannel('kanal') ??
        interaction.channel;

      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.reply({
          content: 'Kunne ikke finde en gyldig kanal til panelet.',
          ephemeral: true
        });
        return;
      }

      try {
        await channel.send({
          embeds: [buildPanelEmbed(interaction)],
          components: [buildCategorySelect()]
        });

        await interaction.reply({
          content: `Ticket-panelet er sendt til ${channel}.`,
          ephemeral: true
        });
      } catch (error) {
        console.error('Kunne ikke sende ticket-panel:', error);
        await interaction.reply({
          content: 'Der skete en fejl under udsendelsen af ticket-panelet.',
          ephemeral: true
        });
      }
      return;
    }

    return;
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId !== CATEGORY_SELECT_ID) {
      return;
    }

    const selectedId = interaction.values[0];
    const category = getCategoryById(selectedId);

    if (!category) {
      await interaction.reply({
        content: 'Kunne ikke finde den valgte kategori.',
        ephemeral: true
      });
      return;
    }

    await createTicket(interaction, category);
    return;
  }

  if (interaction.isButton()) {
    if (interaction.customId !== CREATE_TICKET_BUTTON_ID) {
      return;
    }

    if (!interaction.inGuild()) {
      await interaction.reply({
        content: 'Kan kun bruges på serveren.',
        ephemeral: true
      });
      return;
    }

    if (!isTicketChannel(interaction.channel)) {
      await interaction.reply({
        content: 'Dette er ikke en ticket kanal.',
        ephemeral: true
      });
      return;
    }

    if (!userCanCloseTicket(interaction.member, interaction.channel, interaction.user.id)) {
      await interaction.reply({
        content: 'Du har ikke adgang til at lukke denne ticket.',
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      await interaction.channel.send('Ticketen bliver lukket om 5 sekunder...');
      setTimeout(async () => {
        try {
          await interaction.channel.delete('Ticket lukket via knap');
        } catch (error) {
          console.error('Kunne ikke slette ticket kanal:', error);
        }
      }, 5000);

      await interaction.editReply('Ticketen bliver lukket. Tak for din henvendelse!');
    } catch (error) {
      console.error('Kunne ikke lukke ticket via knap:', error);
      await interaction.editReply('Der skete en fejl under lukning af ticketen.');
    }
  }
});

client.once('ready', () => {
  console.log(`Ticket botten er logget ind som ${client.user.tag}`);
});

(async () => {
  await registerCommands();
  await client.login(DISCORD_TOKEN);
})();
