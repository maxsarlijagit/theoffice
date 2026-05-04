import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDiscordBot, movePlayerToZoneChannel, setVoiceChannels } from './discord.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// Initialize Discord bot (if token provided)
const discordEnabled = process.env.DISCORD_BOT_TOKEN && initDiscordBot();
if (process.env.DISCORD_BOT_TOKEN) {
  setVoiceChannels({
    OFFICE: process.env.DISCORD_VOICE_OFFICE,
    FOCUS_ROOM: process.env.DISCORD_VOICE_FOCUS_ROOM,
    CAFETERIA: process.env.DISCORD_VOICE_CAFETERIA,
    ARCADE: process.env.DISCORD_VOICE_ARCADE,
    STUDIO: process.env.DISCORD_VOICE_STUDIO,
  });
}

// Game state
const players = new Map();
const TILE_SIZE = 16;
const MAP_WIDTH = 36;
const MAP_HEIGHT = 22;

// Simple tilemap: 0 = floor, 1 = wall, 2 = chair, 3 = monitor, 4 = plant, 5 = table
// Zones: OFFICE (0-17, 0-10), FOCUS_ROOM (18-26, 0-10), CAFETERIA (27-35, 0-10), ARCADE (0-8, 11-21), STUDIO (9-26, 11-21)
const WALL_TILES = [1];
const COLLIDABLE_TILES = [1, 2, 3, 4, 5, 6];

// Basic room layout (36x22)
const tilemap = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,2,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,1],
  [1,0,0,2,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,2,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,5,5,5,5,5,5,5,1,1,1,1,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,5,0,0,0,0,0,5,1,1,1,1,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,5,0,0,0,0,0,5,1,1,1,1,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,5,5,5,5,5,5,5,1,1,1,1,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

// Track disconnected sessions for reconnections
const sessionStore = new Map();

// Zone definitions
const ZONES = {
  OFFICE: { x: 0, y: 0, w: 18, h: 11 },
  FOCUS_ROOM: { x: 18, y: 0, w: 9, h: 11 },
  CAFETERIA: { x: 27, y: 0, w: 9, h: 11 },
  ARCADE: { x: 0, y: 11, w: 9, h: 11 },
  STUDIO: { x: 9, y: 11, w: 18, h: 11 },
};

// Helper: is tile collidable
function isCollidable(x, y) {
  if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return true;
  return COLLIDABLE_TILES.includes(tilemap[y][x]);
}

// Helper: get zone by position
function getZone(x, y) {
  for (const [name, zone] of Object.entries(ZONES)) {
    if (x >= zone.x && x < zone.x + zone.w && y >= zone.y && y < zone.y + zone.h) {
      return name;
    }
  }
  return null;
}

// Broadcast to all clients
function broadcast(message, excludeId = null) {
  const data = JSON.stringify(message);
  wss.clients.forEach(client => {
    if (client.readyState === 1 && client.playerId !== excludeId) {
      client.send(data);
    }
  });
}

// Game loop - 10 ticks/second for smooth movement
const TICK_RATE = 100;
setInterval(() => {
  players.forEach((player, id) => {
    if (player.currentKeys && player.currentKeys.length > 0) {
      let dx = 0;
      let dy = 0;
      
      if (player.currentKeys.includes('w') || player.currentKeys.includes('ArrowUp')) dy -= 1;
      if (player.currentKeys.includes('s') || player.currentKeys.includes('ArrowDown')) dy += 1;
      if (player.currentKeys.includes('a') || player.currentKeys.includes('ArrowLeft')) dx -= 1;
      if (player.currentKeys.includes('d') || player.currentKeys.includes('ArrowRight')) dx += 1;
      
      if (dx !== 0 || dy !== 0) {
        // Update 8-way direction
        if (dy < 0 && dx === 0) player.direction = 'N';
        else if (dy > 0 && dx === 0) player.direction = 'S';
        else if (dx > 0 && dy === 0) player.direction = 'E';
        else if (dx < 0 && dy === 0) player.direction = 'W';
        else if (dy < 0 && dx > 0) player.direction = 'NE';
        else if (dy < 0 && dx < 0) player.direction = 'NW';
        else if (dy > 0 && dx > 0) player.direction = 'SE';
        else if (dy > 0 && dx < 0) player.direction = 'SW';

        let targetX = player.x + dx;
        let targetY = player.y + dy;
        
        // Validate movement independently for sliding against walls
        if (!isCollidable(targetX, player.y)) {
          player.x = targetX;
        }
        if (!isCollidable(player.x, targetY)) {
          player.y = targetY;
        }
      }
      
      // Check zone change
      const newZone = getZone(player.x, player.y);
      if (newZone && newZone !== player.zone) {
        broadcast({ type: 'zone_leave', zone: player.zone, playerId: id });
        broadcast({ type: 'zone_enter', zone: newZone, playerId: id });
        player.zone = newZone;
        
        // Move Discord voice channel if linked
        if (discordEnabled && player.discordUserId) {
          movePlayerToZoneChannel(id, newZone);
        }
      }
    }
  });
  
  // Broadcast state
  const playerState = Array.from(players.values()).map(p => ({
    id: p.id,
    name: p.name,
    color: p.color,
    avatarType: p.avatarType,
    direction: p.direction,
    x: p.x,
    y: p.y,
    zone: p.zone,
  }));
  
  broadcast({ type: 'state', players: playerState });
}, TICK_RATE);

// WebSocket connection handler
wss.on('connection', (ws) => {
  let playerId = null;
  let heartbeatTimeout = null;
  let tokens = 100; // Token bucket for rate limiting
  let lastMessageTime = Date.now();
  
  // Check player limit
  if (players.size >= 50) {
    ws.send(JSON.stringify({ type: 'error', message: 'Server full' }));
    ws.close();
    return;
  }
  
  // Reset heartbeat on any message
  const resetHeartbeat = () => {
    clearTimeout(heartbeatTimeout);
    heartbeatTimeout = setTimeout(() => {
      console.log(`[GAME] Player ${playerId} timed out due to inactivity`);
      if (playerId && players.has(playerId)) {
        players.delete(playerId);
        broadcast({ type: 'player_left', playerId });
      }
      ws.terminate();
    }, 300000); // 5 minutes timeout to prevent background tab kicks
  };
  
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      
      // Rate limiting: 100 msgs/min por conexión
      const now = Date.now();
      const elapsed = now - lastMessageTime;
      tokens = Math.min(100, tokens + (elapsed / 60000) * 100);
      lastMessageTime = now;
      
      if (tokens < 1) {
        console.log(`[GAME] Rate limit exceeded for ${playerId || 'unknown'}`);
        return; // Ignore message
      }
      tokens--;
      
      switch (msg.type) {
        case 'join': {
          playerId = msg.sessionId || uuidv4();
          const name = msg.name || 'Anonymous';
          const color = msg.color || '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
          const avatarType = msg.avatarType || 0;
          
          let player;
          if (msg.sessionId && sessionStore.has(msg.sessionId)) {
            // Restore previous session
            const saved = sessionStore.get(msg.sessionId);
            player = {
              ...saved,
              name, // update name/color if they changed in UI
              color,
              avatarType,
              currentKeys: []
            };
          } else {
            // Start in STUDIO area with slight random offset to prevent perfect overlap
            const x = 9 + Math.floor(Math.random() * 5) - 2; // 7 to 11
            const y = 16 + Math.floor(Math.random() * 5) - 2; // 14 to 18
            
            player = {
              id: playerId,
              name,
              color,
              avatarType,
              direction: 'S',
              x,
              y,
              zone: getZone(x, y),
              currentKeys: [],
            };
          }
          
          players.set(playerId, player);
          ws.playerId = playerId;
          
          // Send init state to new player
          const playerState = Array.from(players.values()).map(p => ({
            id: p.id,
            name: p.name,
            color: p.color,
            avatarType: p.avatarType,
            direction: p.direction,
            x: p.x,
            y: p.y,
            zone: p.zone,
          }));
          
          ws.send(JSON.stringify({
            type: 'init',
            myId: playerId,
            players: playerState,
            tilemap,
            zones: ZONES,
          }));
          
          // Broadcast new player
          broadcast({ type: 'player_joined', player: { id: playerId, name, color, avatarType: player.avatarType, direction: player.direction, x, y, zone: player.zone } }, playerId);
          
          resetHeartbeat();
          console.log(`[GAME] Player ${name} (${playerId}) joined`);
          break;
        }
        
        case 'input': {
          if (!playerId || !players.has(playerId)) return;
          const player = players.get(playerId);
          player.currentKeys = msg.keys;
          resetHeartbeat();
          break;
        }
        
        case 'chat': {
          if (!playerId || !players.has(playerId)) return;
          const player = players.get(playerId);
          const message = msg.message.substring(0, 200); // Limit message length
          
          // Proximity chat (30 tiles - visible to anyone reasonably close)
          const proximityTargets = [];
          players.forEach((other, id) => {
            const dist = Math.sqrt(Math.pow(player.x - other.x, 2) + Math.pow(player.y - other.y, 2));
            if (dist <= 30) {
              proximityTargets.push(id);
              const otherWs = Array.from(wss.clients).find(c => c.playerId === id);
              if (otherWs && otherWs.readyState === 1) {
                otherWs.send(JSON.stringify({
                  type: 'chat',
                  from: player.name,
                  color: player.color,
                  message: message,
                  proximity: true,
                  x: player.x,
                  y: player.y,
                }));
              }
            }
          });
          
          // Global chat - always send to everyone
          broadcast({
            type: 'chat',
            from: player.name,
            color: player.color,
            message: message,
            global: true,
          });
          break;
        }
        
        case 'link_discord': {
          if (!playerId || !players.has(playerId)) return;
          const player = players.get(playerId);
          player.discordUserId = msg.discordUserId;
          console.log(`[GAME] Linked Discord user ${msg.discordUserId} to player ${player.name}`);
          break;
        }
        
        case 'heartbeat': {
          resetHeartbeat();
          break;
        }
      }
    } catch (err) {
      console.error('[GAME] Message error:', err.message);
    }
  });
  
  ws.on('close', () => {
    clearTimeout(heartbeatTimeout);
    if (playerId && players.has(playerId)) {
      const player = players.get(playerId);
      console.log(`[GAME] Player ${player.name} disconnected`);
      sessionStore.set(playerId, { ...player, currentKeys: [] });
      players.delete(playerId);
      broadcast({ type: 'player_left', playerId });
    }
  });
});

// Health and stats endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/stats', (req, res) => {
  res.json({
    players: players.size,
    uptime: process.uptime(),
  });
});

// Serve static files
app.use(express.static('public'));
app.use(express.static('client'));

server.listen(PORT, () => {
  console.log(`[SERVER] The Office running on http://localhost:${PORT}`);
});
