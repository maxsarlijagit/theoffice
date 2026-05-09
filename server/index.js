import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDiscordBot, movePlayerToZoneChannel, setVoiceChannels } from './discord.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || 3000;

// ── Load map ──────────────────────────────────────────────────────────────────
const mapJson = JSON.parse(
  readFileSync(new URL('../public/assets/data/map_v1.json', import.meta.url))
);

const TILES = mapJson.tiles;        // [{x,y,type,area}]
const AREA_STYLES = mapJson.areaStyles;
const GRID_W = mapJson.grid.width;  // 32
const GRID_H = mapJson.grid.height; // 32

// Walkable set (all floor tiles)
const walkable = new Set(TILES.map(t => `${t.x},${t.y}`));

// Area (zone) per tile position
const tileArea = new Map(TILES.map(t => [`${t.x},${t.y}`, t.area]));

// Spawn tiles — where new players appear
const spawnTiles = TILES.filter(t => t.area === 'Spawn');

// Wall edge collisions — set of "fromX,fromY,dx,dy" blocked transitions.
// Each JSON wall {x,y,edge} is bidirectional (blocks movement both ways).
const wallBlocks = new Set();
(mapJson.walls ?? []).forEach(({ x, y, edge }) => {
  const deltas = {
    left:   [-1,  0],
    right:  [ 1,  0],
    top:    [ 0, -1],
    bottom: [ 0,  1],
  }[edge];
  if (!deltas) return;
  const [dx, dy] = deltas;
  wallBlocks.add(`${x},${y},${dx},${dy}`);           // tile → neighbour
  wallBlocks.add(`${x + dx},${y + dy},${-dx},${-dy}`); // neighbour → tile
});

// ── Discord ───────────────────────────────────────────────────────────────────
const discordEnabled = process.env.DISCORD_BOT_TOKEN && initDiscordBot();
if (process.env.DISCORD_BOT_TOKEN) {
  setVoiceChannels({
    Open_Office: process.env.DISCORD_VOICE_OPEN_OFFICE,
    Focus:       process.env.DISCORD_VOICE_FOCUS,
    Yard:        process.env.DISCORD_VOICE_YARD,
    Study:       process.env.DISCORD_VOICE_STUDY,
    Arcade:      process.env.DISCORD_VOICE_ARCADE,
    Coffee:      process.env.DISCORD_VOICE_COFFEE,
    Spawn:       process.env.DISCORD_VOICE_SPAWN,
  });
}

// ── Game state ────────────────────────────────────────────────────────────────
const players = new Map();
const sessionStore = new Map();
const sessionTimers = new Map(); // sessionId → eviction timeout

function scheduleSessionEviction(sessionId) {
  clearTimeout(sessionTimers.get(sessionId));
  const t = setTimeout(() => {
    sessionStore.delete(sessionId);
    sessionTimers.delete(sessionId);
  }, 15 * 60_000);
  sessionTimers.set(sessionId, t);
}

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
function sanitizeName(s)  { return (s ?? '').replace(/[<>]/g, '').substring(0, 20); }
function sanitizeColor(s) { return COLOR_RE.test(s) ? s : '#3b82f6'; }
function sanitizeMsg(s)   { return (s ?? '').replace(/[<>]/g, '').substring(0, 200); }

function isWalkable(x, y) {
  if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return false;
  return walkable.has(`${x},${y}`);
}

function getZone(x, y) {
  return tileArea.get(`${x},${y}`) ?? null;
}

function randomSpawn() {
  const t = spawnTiles[Math.floor(Math.random() * spawnTiles.length)];
  return { x: t.x, y: t.y };
}

// ── Broadcast ─────────────────────────────────────────────────────────────────
function broadcast(msg, excludeId = null) {
  const data = JSON.stringify(msg);
  wss.clients.forEach(c => {
    if (c.readyState === 1 && c.playerId !== excludeId) c.send(data);
  });
}

// ── Game loop — 10 ticks/sec ──────────────────────────────────────────────────
const TICK_RATE = 100;
let lastForcedBroadcast = Date.now();

setInterval(() => {
  let anyMoved = false;

  players.forEach((player, id) => {
    const keys = player.currentKeys;
    if (!keys || keys.length === 0) return;

    let dx = 0, dy = 0;
    if (keys.includes('w')) dy -= 1;
    if (keys.includes('s')) dy += 1;
    if (keys.includes('a')) dx -= 1;
    if (keys.includes('d')) dx += 1;

    if (dx === 0 && dy === 0) return;

    // 8-way facing direction
    const dirs = { '-1,0': 'W', '1,0': 'E', '0,-1': 'N', '0,1': 'S',
                   '1,-1': 'NE', '-1,-1': 'NW', '1,1': 'SE', '-1,1': 'SW' };
    player.direction = dirs[`${dx},${dy}`] ?? player.direction;

    // Slide-against-wall collision (tile bounds + edge walls)
    if (isWalkable(player.x + dx, player.y) &&
        !wallBlocks.has(`${player.x},${player.y},${dx},0`))   player.x += dx;
    if (isWalkable(player.x, player.y + dy) &&
        !wallBlocks.has(`${player.x},${player.y},0,${dy}`))   player.y += dy;

    anyMoved = true;

    // Zone change
    const newZone = getZone(player.x, player.y);
    if (newZone && newZone !== player.zone) {
      broadcast({ type: 'zone_leave', zone: player.zone, playerId: id });
      broadcast({ type: 'zone_enter', zone: newZone,  playerId: id });
      player.zone = newZone;
      if (discordEnabled && player.discordUserId) {
        movePlayerToZoneChannel(id, newZone);
      }
    }
  });

  const now = Date.now();
  const forceDue = now - lastForcedBroadcast >= 1000;
  if (anyMoved || forceDue) {
    const state = Array.from(players.values()).map(p => ({
      id: p.id, name: p.name, color: p.color,
      avatarType: p.avatarType, direction: p.direction,
      x: p.x, y: p.y, zone: p.zone,
    }));
    broadcast({ type: 'state', players: state });
    if (forceDue) lastForcedBroadcast = now;
  }
}, TICK_RATE);

// ── WebSocket handler ─────────────────────────────────────────────────────────
wss.on('connection', ws => {
  let playerId = null;
  let heartbeatTimeout = null;
  let tokens = 100;
  let lastMsg = Date.now();

  if (players.size >= 50) {
    ws.send(JSON.stringify({ type: 'error', message: 'Server full' }));
    ws.close();
    return;
  }

  const resetHeartbeat = () => {
    clearTimeout(heartbeatTimeout);
    heartbeatTimeout = setTimeout(() => {
      if (playerId && players.has(playerId)) {
        players.delete(playerId);
        broadcast({ type: 'player_left', playerId });
      }
      ws.terminate();
    }, 300_000); // 5-min idle timeout
  };

  ws.on('message', data => {
    try {
      const msg = JSON.parse(data);

      // Token-bucket rate limit: 100 msgs/min
      const now = Date.now();
      tokens = Math.min(100, tokens + ((now - lastMsg) / 60_000) * 100);
      lastMsg = now;
      if (tokens < 1) return;
      tokens--;

      switch (msg.type) {
        case 'join': {
          playerId = msg.sessionId || uuidv4();
          const name = sanitizeName(msg.name || 'Anonymous');
          const color = sanitizeColor(msg.color);
          const avatarType = msg.avatarType ?? 0;
          clearTimeout(sessionTimers.get(playerId)); // cancel eviction on reconnect
          sessionTimers.delete(playerId);

          let player;
          if (msg.sessionId && sessionStore.has(msg.sessionId)) {
            player = { ...sessionStore.get(msg.sessionId), name, color, avatarType, currentKeys: [] };
          } else {
            const spawn = randomSpawn();
            player = {
              id: playerId, name, color, avatarType,
              direction: 'S', currentKeys: [],
              x: spawn.x, y: spawn.y,
              zone: getZone(spawn.x, spawn.y),
            };
          }

          players.set(playerId, player);
          ws.playerId = playerId;

          const playerState = Array.from(players.values()).map(p => ({
            id: p.id, name: p.name, color: p.color,
            avatarType: p.avatarType, direction: p.direction,
            x: p.x, y: p.y, zone: p.zone,
          }));

          ws.send(JSON.stringify({
            type: 'init',
            myId: playerId,
            players: playerState,
            map: mapJson, // full map sent once on join
          }));

          broadcast({
            type: 'player_joined',
            player: {
              id: playerId, name, color, avatarType: player.avatarType,
              direction: player.direction, x: player.x, y: player.y, zone: player.zone,
            },
          }, playerId);

          resetHeartbeat();
          console.log(`[GAME] ${name} (${playerId}) joined at (${player.x},${player.y})`);
          break;
        }

        case 'input': {
          if (!playerId || !players.has(playerId)) return;
          players.get(playerId).currentKeys = msg.keys ?? [];
          resetHeartbeat();
          break;
        }

        case 'chat': {
          if (!playerId || !players.has(playerId)) return;
          const player = players.get(playerId);
          const message = sanitizeMsg(msg.message);

          // Proximity chat (30-tile radius) — includes playerId so client can attach bubble
          players.forEach((other, oid) => {
            const dist = Math.hypot(player.x - other.x, player.y - other.y);
            if (dist > 30) return;
            const sock = Array.from(wss.clients).find(c => c.playerId === oid);
            if (sock?.readyState === 1) {
              sock.send(JSON.stringify({
                type: 'chat', from: player.name, color: player.color,
                message, proximity: true,
                playerId, x: player.x, y: player.y,
              }));
            }
          });

          // Global chat
          broadcast({ type: 'chat', from: player.name, color: player.color, message, global: true });
          break;
        }

        case 'link_discord': {
          if (!playerId || !players.has(playerId)) return;
          players.get(playerId).discordUserId = msg.discordUserId;
          break;
        }

        case 'heartbeat':
          resetHeartbeat();
          break;
      }
    } catch (err) {
      console.error('[GAME] message error:', err.message);
    }
  });

  ws.on('close', () => {
    clearTimeout(heartbeatTimeout);
    if (playerId && players.has(playerId)) {
      const player = players.get(playerId);
      console.log(`[GAME] ${player.name} disconnected`);
      sessionStore.set(playerId, { ...player, currentKeys: [] });
      players.delete(playerId);
      broadcast({ type: 'player_left', playerId });
      scheduleSessionEviction(playerId);
    }
  });
});

// ── HTTP ──────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
app.get('/stats',  (_req, res) => res.json({ players: players.size, uptime: process.uptime() }));

// In production, serve the Vite build. In dev, Vite runs its own server.
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'dist')));
}
app.use(express.static(path.join(__dirname, '..', 'public')));

server.listen(PORT, () => {
  console.log(`[SERVER] The Office on http://localhost:${PORT}`);
  console.log(`[MAP] ${TILES.length} tiles, ${spawnTiles.length} spawn points`);
});
