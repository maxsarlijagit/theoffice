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

// Zona definitions
const zones = {
  'open-office': { 
    x: 0, y: 0, width: 10, height: 8, 
    music: 'lofi', 
    bgColor: '#1a2a4a',
    spawn: { x: 5, y: 4 } 
  },
  'focus-room': { 
    x: 10, y: 0, width: 4, height: 4, 
    music: 'silence', 
    bgColor: '#2d1b1b',
    spawn: { x: 12, y: 2 } 
  },
  'cafeteria': { 
    x: 14, y: 0, width: 6, height: 8, 
    music: 'upbeat', 
    bgColor: '#2d2d1b',
    spawn: { x: 17, y: 4 } 
  },
  'arcade': { 
    x: 0, y: 8, width: 8, height: 6, 
    music: 'energetic', 
    bgColor: '#1b2d1b',
    spawn: { x: 4, y: 11 } 
  },
  'estudio': { 
    x: 8, y: 8, width: 6, height: 6, 
    music: 'neutral', 
    bgColor: '#2d1b2d',
    spawn: { x: 11, y: 11 } 
  }
};

const world = {
  players: new Map(),
  zones
};

const clients = new Map();

// Player palette
const PLAYER_COLORS = [
  '#e94560', '#0f3460', '#4a69bd', '#6a89cc',
  '#78e08f', '#e58e26', '#fa983a', '#eb5757',
  '#9b59b6', '#1abc9c', '#3498db', '#e74c3c'
];

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
  for (const [id, player] of world.players) {
    state[id] = player;
  }
  return state;
}

function getNearbyPlayers(playerId, radius = 3) {
  const player = world.players.get(playerId);
  if (!player) return [];
  
  const nearby = [];
  const px = player.x;
  const py = player.y;
  
  for (const [id, p] of world.players) {
    if (id === playerId) continue;
    const dist = Math.sqrt((p.x - px) ** 2 + (p.y - py) ** 2);
    if (dist <= radius) {
      nearby.push({ id, name: p.name, distance: dist });
    }
  }
  return nearby;
}

wss.on('connection', (ws) => {
  console.log('🔌 Nueva conexión');

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      handleMessage(ws, msg);
    } catch (e) {
      console.error('❌ Mensaje inválido:', e.message);
    }
  });

  ws.on('close', () => {
    const playerId = clients.get(ws);
    if (playerId) {
      console.log(`👋 Player desconectado: ${playerId}`);
      world.players.delete(playerId);
      clients.delete(ws);
      broadcast('player-left', { playerId });
    }
  });
});

function handleMessage(ws, msg) {
  const { type, data } = msg;
  const playerId = clients.get(ws);

  switch (type) {
    case 'join': {
      const id = uuidv4().slice(0, 8);
      const colorIndex = world.players.size % PLAYER_COLORS.length;
      const player = {
        id,
        name: data.name || `Player_${id}`,
        color: PLAYER_COLORS[colorIndex],
        x: 5,
        y: 4,
        zone: 'open-office',
        lastUpdate: Date.now()
      };
      world.players.set(id, player);
      clients.set(ws, id);
      
      // Send welcome with full state + zones
      ws.send(JSON.stringify({
        type: 'welcome',
        data: { 
          playerId: id, 
          world: getPlayerState(), 
          zones: world.zones,
          color: player.color
        }
      }));
      
      broadcast('player-joined', player);
      console.log(`👤 ${player.name} joined (${id})`);
      break;
    }

    case 'move': {
      const p = world.players.get(playerId);
      if (p && data) {
        let newZone = p.zone;
        
        for (const [zoneName, zone] of Object.entries(world.zones)) {
          const { x, y, width, height } = zone;
          if (data.x >= x && data.x < x + width && data.y >= y && data.y < y + height) {
            newZone = zoneName;
            break;
          }
        }
        
        p.x = data.x;
        p.y = data.y;
        p.zone = newZone;
        p.lastUpdate = Date.now();
        
        broadcast('player-moved', { playerId, x: data.x, y: data.y, zone: newZone });
      }
      break;
    }

    case 'chat': {
      const p = world.players.get(playerId);
      if (!p || !data.text) break;
      
      const text = data.text.slice(0, 200);
      
      // Send to nearby players
      const nearby = getNearbyPlayers(playerId);
      const nearbyMsg = JSON.stringify({
        type: 'chat',
        data: {
          from: p.name,
          fromId: playerId,
          text,
          zone: p.zone,
          timestamp: Date.now()
        }
      });
      
      // Send to sender too
      ws.send(nearbyMsg);
      
      // Broadcast to nearby (excluding sender handled by proximity)
      for (const [ws2, pid] of clients) {
        if (pid !== playerId) {
          const otherPlayer = world.players.get(pid);
          const dist = Math.sqrt((otherPlayer.x - p.x) ** 2 + (otherPlayer.y - p.y) ** 2);
          if (dist <= 3) {
            try { ws2.send(nearbyMsg); } catch(e) {}
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

// Heartbeat
setInterval(() => {
  for (const [ws, pid] of clients) {
    if (!ws.isAlive) {
      console.log(`💀 Heartbeat fail: ${pid}`);
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
  console.log(`🚀 The Office server running on port ${PORT}`);
  console.log(`🌐 https://theoffice-production.up.railway.app`);
});