# Discord Ticket Bot

En simpel Discord ticket bot til DanishRP med slash commands.

## Funktioner
- `/ticket panel` sender et embed med *Create ticket*-knap til en kanal.
- Brugere klikker på knappen eller bruger `/ticket create` for at åbne en ticket.
- `/ticket add <bruger>` giver staff mulighed for at tilføje ekstra medlemmer til en ticket.
- `/ticket close` eller knappen i ticketen lukker kanalen efter 5 sekunder.
- Begrænser brugere til én aktiv ticket ad gangen.

## Krav
- Node.js 18 eller nyere.
- En Discord bot med guild intents (Members + Messages) aktiveret.
- ID på den guild, staff-rolle og (valgfrit) kategori til tickets.

## Konfiguration
1. Kopier `.env.example` til `.env`.
2. Udfyld værdierne:
   - `DISCORD_TOKEN`: Bot token fra Developer Portal.
   - `DISCORD_CLIENT_ID`: Botens application/client ID.
   - `DISCORD_GUILD_ID`: Server ID hvor kommandoer registreres.
   - `STAFF_ROLE_ID`: Rolle-ID for support-teamet.
   - `TICKET_CATEGORY_ID`: (valgfrit) kategori-ID hvor tickets skal placeres.

## Installation
```bash
npm install
```

## Kørsel
```bash
npm start
```

Første gang botten starter, registrerer den slash commands i den angivne guild.
