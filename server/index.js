import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, '../client')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', players: world.players.size });
});

// Player statuses
const STATUS = { AVAILABLE: 'available', FOCUS: 'focus', MEETING: 'meeting', BREAK: 'break' };

const zones = {
  'open-office': {
    x: 0, y: 0, width: 10, height: 8,
    bgColor: '#1a2a4a', music: 'lofi',
    spawn: { x: 5, y: 4 },
    objects: [
      { type: 'desk', x: 2, y: 2, w: 2, h: 1 },
      { type: 'desk', x: 6, y: 2, w: 2, h: 1 },
      { type: 'desk', x: 2, y: 5, w: 2, h: 1 },
      { type: 'desk', x: 6, y: 5, w: 2, h: 1 },
      { type: 'plant', x: 1, y: 1 },
      { type: 'plant', x: 9, y: 1 },
      { type: 'plant', x: 1, y: 6 },
      { type: 'plant', x: 9, y: 6 }
    ]
  },
  'focus-room': {
    x: 10, y: 0, width: 4, height: 4,
    bgColor: '#2d1b1b', music: 'silence',
    spawn: { x: 12, y: 2 },
    objects: [
      { type: 'desk', x: 11, y: 1, w: 2, h: 1 },
      { type: 'plant', x: 10, y: 3 }
    ]
  },
  'cafeteria': {
    x: 14, y: 0, width: 6, height: 8,
    bgColor: '#2d2d1b', music: 'upbeat',
    spawn: { x: 17, y: 4 },
    objects: [
      { type: 'table', x: 15, y: 2, w: 2, h: 2 },
      { type: 'table', x: 18, y: 5, w: 2, h: 2 },
      { type: 'plant', x: 14, y: 1 },
      { type: 'plant', x: 19, y: 7 }
    ]
  },
  'arcade': {
    x: 0, y: 8, width: 8, height: 6,
    bgColor: '#1b2d1b', music: 'energetic',
    spawn: { x: 4, y: 11 },
    objects: [
      { type: 'machine', x: 1, y: 9, w: 1, h: 2 },
      { type: 'machine', x: 3, y: 9, w: 1, h: 2 },
      { type: 'machine', x: 5, y: 9, w: 1, h: 2 },
      { type: 'machine', x: 7, y: 9, w: 1, h: 2 },
      { type: 'plant', x: 0, y: 8 },
      { type: 'plant', x: 8, y: 8 }
    ]
  },
  'estudio': {
    x: 8, y: 8, width: 6, height: 6,
    bgColor: '#2d1b2d', music: 'neutral',
    spawn: { x: 11, y: 11 },
    objects: [
      { type: 'desk', x: 9, y: 10, w: 2, h: 1 },
      { type: 'desk', x: 12, y: 10, w: 2, h: 1 },
      { type: 'plant', x: 8, y: 9 },
      { type: 'plant', x: 14, y: 9 }
    ]
  }
};

const world = { players: new Map(), zones };

const CLIENT_COLORS = [
  '#e94560', '#0f3460', '#4a69bd', '#6a89cc',
  '#78e08f', '#e58e26', '#fa983a', '#eb5757',
  '#9b59b6', '#1abc9c', '#3498db', '#e74c3c'
];

const clients = new Map();

function broadcast(type, data, excludeWs = null) {
  const msg = JSON.stringify({ type, data });
  for (const [ws] of clients) {
    if (ws !== excludeWs && ws.readyState === 1) {
      try { ws.send(msg); } catch(e) {}
    }
  }
}

function getPlayerState() {
  const state = {};
  for (const [id, player] of world.players) state[id] = player;
  return state;
}

function getNearbyPlayers(playerId, radius = 3) {
  const player = world.players.get(playerId);
  if (!player) return [];
  const nearby = [];
  for (const [id, p] of world.players) {
    if (id === playerId) continue;
    const dist = Math.sqrt((p.x - player.x)**2 + (p.y - player.y)**2);
    if (dist <= radius) nearby.push({ id, name: p.name, dist, status: p.status });
  }
  return nearby;
}

function getAudioLevel(dist) {
  if (dist <= 0.5) return 1.0;
  if (dist <= 1.5) return 0.8;
  if (dist <= 3) return 0.4;
  return 0;
}

wss.on('connection', (ws) => {
  console.log('🔌 Conexión nueva');
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', data => {
    try { handleMessage(ws, JSON.parse(data)); } catch(e) {}
  });
  ws.on('close', () => {
    const pid = clients.get(ws);
    if (pid) {
      world.players.delete(pid);
      clients.delete(ws);
      broadcast('player-left', { playerId: pid });
    }
  });
});

function handleMessage(ws, msg) {
  const { type, data } = msg;
  const pid = clients.get(ws);

  switch (type) {
    case 'join': {
      const id = uuidv4().slice(0, 8);
      const colorIdx = world.players.size % CLIENT_COLORS.length;
      const player = {
        id, name: data.name || `Player_${id}`,
        color: CLIENT_COLORS[colorIdx],
        x: 5, y: 4, zone: 'open-office',
        status: STATUS.AVAILABLE,
        avatar: data.avatar || { body: 0, outfit: 0, hair: 0, color: CLIENT_COLORS[colorIdx] },
        lastUpdate: Date.now()
      };
      world.players.set(id, player);
      clients.set(ws, id);
      
      ws.send(JSON.stringify({
        type: 'welcome',
        data: { playerId: id, world: getPlayerState(), zones: world.zones, color: player.color }
      }));
      broadcast('player-joined', player);
      console.log(`👤 ${player.name} joined`);
      break;
    }
    case 'move': {
      const p = world.players.get(pid);
      if (p && data) {
        let newZone = p.zone;
        for (const [zName, zone] of Object.entries(world.zones)) {
          const { x, y, width, height } = zone;
          if (data.x >= x && data.x < x + width && data.y >= y && data.y < y + height) {
            newZone = zName; break;
          }
        }
        p.x = data.x; p.y = data.y; p.zone = newZone; p.lastUpdate = Date.now();
        
        // Broadcast move only (no echo to sender)
        const moveMsg = JSON.stringify({ type: 'player-moved', data: { playerId: pid, x: data.x, y: data.y, zone: newZone } });
        for (const [ws2, pid2] of clients) {
          if (pid2 !== pid && ws2.readyState === 1) {
            try { ws2.send(moveMsg); } catch(e) {}
          }
        }
        
        // Send proximity updates to this player
        const nearby = getNearbyPlayers(pid);
        ws.send(JSON.stringify({ type: 'nearby', data: { players: nearby } }));
      }
      break;
    }
    case 'status': {
      const p = world.players.get(pid);
      if (p && data?.status) {
        p.status = data.status;
        broadcast('player-status', { playerId: pid, status: p.status });
      }
      break;
    }
    case 'chat': {
      const p = world.players.get(pid);
      if (!p || !data?.text) break;
      const text = data.text.slice(0, 200);
      
      // Proximity audio levels for nearby players
      const nearby = getNearbyPlayers(pid);
      
      const chatMsg = JSON.stringify({
        type: 'chat',
        data: { from: p.name, fromId: pid, text, zone: p.zone, timestamp: Date.now() }
      });
      
      // Send to sender with audio levels
      ws.send(JSON.stringify({
        type: 'chat',
        data: { from: p.name, fromId: pid, text, zone: p.zone, timestamp: Date.now(), audioLevel: 1.0, self: true }
      }));
      
      // Broadcast to nearby
      for (const [ws2, pid2] of clients) {
        if (pid2 !== pid) {
          const other = world.players.get(pid2);
          const dist = Math.sqrt((other.x - p.x)**2 + (other.y - p.y)**2);
          const audioLevel = getAudioLevel(dist);
          if (dist <= 3) {
            try {
              ws2.send(JSON.stringify({
                type: 'chat',
                data: { from: p.name, fromId: pid, text, zone: p.zone, timestamp: Date.now(), audioLevel }
              }));
            } catch(e) {}
          }
        }
      }
      break;
    }
    case 'ping': {
      ws.send(JSON.stringify({ type: 'pong', data: { ts: Date.now() } }));
      break;
    }
  }
}

setInterval(() => {
  for (const [ws, pid] of clients) {
    if (!ws.isAlive) {
      const p = world.players.get(pid);
      world.players.delete(pid);
      clients.delete(ws);
      if (p) broadcast('player-left', { playerId: pid });
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    try { ws.ping(); } catch(e) {}
  }
}, 30000);

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
