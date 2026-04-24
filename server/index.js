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

// Player status
const STATUS = { AVAILABLE: 'available', FOCUS: 'focus', MEETING: 'meeting', BREAK: 'break' };

// Map data: 20x17 tiles, each tile 32px
const zones = {
  'open-office': {
    x: 0, y: 0, width: 10, height: 8,
    bgColor: '#0d1b2a', floorColor: '#1b263b', music: 'lofi',
    spawn: { x: 5, y: 4 },
    // Tile map: 0=empty, 1=desk, 2=plant, 3=computer, 4=chair, 5=bookshelf
    tiles: [
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,2,0,0,0,0,2,0,0],
      [0,1,1,1,0,0,1,1,1,0],
      [0,0,4,0,0,0,0,4,0,0],
      [0,0,3,0,0,0,0,3,0,0],
      [0,1,1,1,0,0,1,1,1,0],
      [0,0,2,0,0,0,0,2,0,0],
      [0,0,0,0,0,0,0,0,0,0],
    ]
  },
  'focus-room': {
    x: 10, y: 0, width: 4, height: 4,
    bgColor: '#1a0a0a', floorColor: '#2d1b1b', music: 'silence',
    spawn: { x: 12, y: 2 },
    tiles: [
      [0,0,0,0],
      [0,2,2,0],
      [0,1,1,0],
      [0,0,0,0],
    ]
  },
  'cafeteria': {
    x: 14, y: 0, width: 6, height: 8,
    bgColor: '#1a1a0a', floorColor: '#2d2d1b', music: 'upbeat',
    spawn: { x: 17, y: 4 },
    tiles: [
      [0,0,0,0,0,0],
      [0,2,0,0,0,2],
      [0,0,5,5,0,0],
      [0,0,0,0,0,0],
      [0,2,0,0,0,2],
      [0,0,5,5,0,0],
      [0,0,0,0,0,0],
      [0,0,0,0,0,0],
    ]
  },
  'arcade': {
    x: 0, y: 8, width: 8, height: 6,
    bgColor: '#0a1a0a', floorColor: '#1b2d1b', music: 'energetic',
    spawn: { x: 4, y: 11 },
    tiles: [
      [0,0,2,0,0,0,0,2],
      [0,6,6,0,6,6,0,0],
      [0,6,6,0,6,6,0,0],
      [0,0,0,0,0,0,0,0],
      [0,2,0,0,0,0,2,0],
      [0,0,0,0,0,0,0,0],
    ]
  },
  'estudio': {
    x: 8, y: 8, width: 6, height: 6,
    bgColor: '#1a0a1a', floorColor: '#2d1b2d', music: 'neutral',
    spawn: { x: 11, y: 11 },
    tiles: [
      [0,0,2,2,0,0],
      [0,1,1,1,1,0],
      [0,0,4,4,0,0],
      [0,0,3,3,0,0],
      [0,1,1,1,1,0],
      [0,0,2,2,0,0],
    ]
  }
};

// Tile sprite definitions (pixelart, drawn procedurally)
const TILE_SPRITES = {
  1: { // desk
    w: 2, h: 1,
    draw: (ctx, x, y, TILE) => {
      ctx.fillStyle = '#3d2914';
      ctx.fillRect(x+2, y+TILE-8, TILE*2-4, 8);
      ctx.fillStyle = '#4a3520';
      ctx.fillRect(x+4, y+TILE-6, TILE*2-8, 4);
    }
  },
  2: { // plant
    w: 1, h: 1,
    draw: (ctx, x, y, TILE) => {
      ctx.fillStyle = '#1a4a1a';
      ctx.beginPath();
      ctx.ellipse(x+TILE/2, y+TILE/2-2, 10, 8, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#2d6b2d';
      ctx.beginPath();
      ctx.ellipse(x+TILE/2+3, y+TILE/2-4, 6, 5, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#4a3020';
      ctx.fillRect(x+TILE/2-3, y+TILE/2+4, 6, 6);
    }
  },
  3: { // computer
    w: 1, h: 1,
    draw: (ctx, x, y, TILE) => {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(x+8, y+10, 16, 12);
      ctx.fillStyle = '#4a69bd';
      ctx.fillRect(x+10, y+12, 12, 8);
      ctx.fillStyle = '#6a89cc';
      ctx.fillRect(x+12, y+13, 8, 6);
      ctx.fillStyle = '#2d2d3d';
      ctx.fillRect(x+8, y+22, 16, 4);
    }
  },
  4: { // chair
    w: 1, h: 1,
    draw: (ctx, x, y, TILE) => {
      ctx.fillStyle = '#2d2d4a';
      ctx.fillRect(x+10, y+16, 12, 10);
      ctx.fillStyle = '#4a4a6a';
      ctx.fillRect(x+8, y+8, 16, 10);
      ctx.fillRect(x+10, y+26, 12, 4);
    }
  },
  5: { // table (cafeteria)
    w: 2, h: 2,
    draw: (ctx, x, y, TILE) => {
      ctx.fillStyle = '#3d5a3d';
      ctx.fillRect(x+2, y+2, TILE*2-4, TILE*2-4);
      ctx.fillStyle = '#4a6b4a';
      ctx.fillRect(x+6, y+6, TILE*2-12, TILE*2-12);
    }
  },
  6: { // arcade machine
    w: 1, h: 2,
    draw: (ctx, x, y, TILE) => {
      ctx.fillStyle = '#1a2a4a';
      ctx.fillRect(x+4, y+4, TILE-8, TILE*2-4);
      ctx.fillStyle = '#e94560';
      ctx.fillRect(x+8, y+10, 6, 6);
      ctx.fillStyle = '#4a69bd';
      ctx.fillRect(x+8, y+20, 6, 6);
      ctx.fillStyle = '#0f3460';
      ctx.fillRect(x+6, y+6, TILE-12, 10);
    }
  }
};

// Player animation frames (pixelart walk cycle)
const PLAYER_PALETTE = [
  { skin: '#f5c6a5', shirt: '#e94560', pants: '#2d2d4a', hair: '#3d2314' },
  { skin: '#8d5524', shirt: '#4a69bd', pants: '#1a1a2e', hair: '#0f0f0f' },
  { skin: '#f5c6a5', shirt: '#78e08f', pants: '#2d4a2d', hair: '#c4a35a' },
  { skin: '#c68642', shirt: '#9b59b6', pants: '#2d1b2d', hair: '#1a1a1a' },
  { skin: '#f5c6a5', shirt: '#e58e26', pants: '#3d2914', hair: '#6b4423' },
  { skin: '#8d5524', shirt: '#e74c3c', pants: '#2d1b1b', hair: '#2d1b1b' },
];

const world = { players: new Map(), zones };

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

function getNearbyPlayers(pid, radius = 3) {
  const p = world.players.get(pid);
  if (!p) return [];
  const nearby = [];
  for (const [id, pl] of world.players) {
    if (id === pid) continue;
    const dist = Math.sqrt((pl.x - p.x)**2 + (pl.y - p.y)**2);
    if (dist <= radius) nearby.push({ id, name: pl.name, dist, status: pl.status });
  }
  return nearby;
}

function getAudioLevel(dist) {
  if (dist <= 0.5) return 1.0;
  if (dist <= 1.5) return 0.8;
  if (dist <= 3) return 0.4;
  return 0;
}

wss.on('connection', ws => {
  console.log('🔌 Connection');
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', data => {
    try { handleMsg(ws, JSON.parse(data)); } catch(e) {}
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

function handleMsg(ws, msg) {
  const { type, data } = msg;
  const pid = clients.get(ws);

  switch (type) {
    case 'join': {
      const id = uuidv4().slice(0, 8);
      const paletteIdx = world.players.size % PLAYER_PALETTE.length;
      const p = {
        id, name: data.name || `Player_${id}`,
        paletteIdx,
        x: 5, y: 4, zone: 'open-office',
        status: STATUS.AVAILABLE,
        frame: 0, facing: 1,
        lastUpdate: Date.now()
      };
      world.players.set(id, p);
      clients.set(ws, id);
      
      ws.send(JSON.stringify({
        type: 'welcome',
        data: { playerId: id, world: getPlayerState(), zones: world.zones, paletteIdx }
      }));
      broadcast('player-joined', p);
      console.log(`👤 ${p.name} joined`);
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
        // Update facing based on direction
        if (data.x !== p.x) p.facing = data.x > p.x ? 1 : -1;
        p.x = data.x; p.y = data.y; p.zone = newZone; p.lastUpdate = Date.now();
        
        const moveMsg = JSON.stringify({ type: 'player-moved', data: { playerId: pid, x: data.x, y: data.y, zone: newZone, facing: p.facing } });
        for (const [ws2, pid2] of clients) {
          if (pid2 !== pid && ws2.readyState === 1) {
            try { ws2.send(moveMsg); } catch(e) {}
          }
        }
        ws.send(JSON.stringify({ type: 'nearby', data: { players: getNearbyPlayers(pid) } }));
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
    case 'animate': {
      const p = world.players.get(pid);
      if (p && data?.frame !== undefined) {
        p.frame = data.frame;
        broadcast('player-animated', { playerId: pid, frame: data.frame });
      }
      break;
    }
    case 'chat': {
      const p = world.players.get(pid);
      if (!p || !data?.text) break;
      const text = data.text.slice(0, 200);
      const chatMsg = JSON.stringify({ type: 'chat', data: { from: p.name, fromId: pid, text, zone: p.zone, timestamp: Date.now(), audioLevel: 1.0, self: true } });
      ws.send(chatMsg);
      
      for (const [ws2, pid2] of clients) {
        if (pid2 !== pid) {
          const other = world.players.get(pid2);
          const dist = Math.sqrt((other.x - p.x)**2 + (other.y - p.y)**2);
          if (dist <= 3) {
            try { ws2.send(JSON.stringify({ type: 'chat', data: { from: p.name, fromId: pid, text, zone: p.zone, timestamp: Date.now(), audioLevel: getAudioLevel(dist) } })); } catch(e) {}
          }
        }
      }
      break;
    }
    case 'ping': ws.send(JSON.stringify({ type: 'pong', data: { ts: Date.now() } })); break;
  }
}

// Walk animation cycle
setInterval(() => {
  for (const [id, p] of world.players) {
    p.frame = (p.frame + 1) % 4;
  }
}, 150);

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
  console.log(`🚀 Server running on ${PORT}`);
});