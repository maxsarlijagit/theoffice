// Discord bot integration for voice channel zones
import { Client, GatewayIntentBits } from 'discord.js';

let discordClient = null;
let voiceChannels = {};
let botToken = process.env.DISCORD_BOT_TOKEN;

// Player Discord ID mapping
const playerDiscordIds = new Map();

export function initDiscordBot() {
  if (!botToken) {
    console.log('[DISCORD] Bot token not configured - voice features disabled');
    return false;
  }

  try {
    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
      ],
    });

    discordClient.once('ready', () => {
      console.log(`[DISCORD] Bot logged in as ${discordClient.user.tag}`);
    });

    discordClient.login(botToken);
    return true;
  } catch (err) {
    console.error('[DISCORD] Failed to init:', err.message);
    return false;
  }
}

export function setVoiceChannels(channels) {
  // channels: { OFFICE: 'channelId', FOCUS_ROOM: 'channelId', ... }
  voiceChannels = channels;
}

export function linkDiscordUser(playerId, discordUserId) {
  playerDiscordIds.set(playerId, discordUserId);
}

export async function movePlayerToZoneChannel(playerId, zone) {
  if (!discordClient || !discordClient.ready) {
    return;
  }

  const discordUserId = playerDiscordIds.get(playerId);
  if (!discordUserId) {
    return;
  }

  const channelId = voiceChannels[zone];
  if (!channelId) {
    return;
  }

  try {
    // Find the voice channel
    const channel = await discordClient.channels.fetch(channelId);
    if (!channel || channel.type !== 2) { // 2 = voice
      console.log(`[DISCORD] Channel not found for zone ${zone}`);
      return;
    }

    // Move the user (requires the bot to be in the channel first)
    // Note: This is a simplified version - real implementation needs
    // the bot to have MOVE_MEMBERS permission and be in the channel
    console.log(`[DISCORD] Would move user ${discordUserId} to ${channel.name}`);
  } catch (err) {
    console.error('[DISCORD] Move error:', err.message);
  }
}

export function isConfigured() {
  return !!botToken && !!discordClient;
}