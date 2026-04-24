import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// Rate limiter
const rateLimiter = new Map();
const RATE_LIMIT = 100; // msgs per minute
const RATE_WINDOW = 60000;

function checkRateLimit(ws) {
  const now = Date.now();
  if (!rateLimiter.has(ws)) rateLimiter.set(ws, []);
  const times = rateLimiter.get(ws).filter(t => now - t < RATE_WINDOW);
  rateLimiter.set(ws, times);
  if (times.length >= RATE_LIMIT) return false;
  times.push(now);
  return true;
}

// Sessions — persist player identity on reconnect
const sessions = new Map(); // sessionId -> { playerId, name, paletteIdx, x, y, zone, status, lastSeen }

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.use(express.static(path.join(__dirname, '../client')));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    players: world.players.size,
    uptime: process.uptime(),
    memory: process.memoryUsage().heapUsed / 1024 / 1024,
    version: '1.0.0'
  });
});

app.get('/stats', (req, res) => {
  res.json({
    players: world.players.size,
    sessions: sessions.size,
    connections: clients.size,
    zones: Object.keys(zones).length
  });
});

const STATUS = { AVAILABLE: 'available', FOCUS: 'focus', MEETING: 'meeting', BREAK: 'break' };

const zones = {
  'open-office': {
    x: 0, y: 0, width: 10, height: 8,
    bgColor: '#0d1b2a', floorColor: '#1b263b', music: 'lofi',
    spawn: { x: 5, y: 4 },
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
    tiles: [[0,0,0,0],[0,2,2,0],[0,1,1,0],[0,0,0,0]]
  },
  'cafeteria': {
    x: 14, y: 0, width: 6, height: 8,
    bgColor: '#1a1a0a', floorColor: '#2d2d1b', music: 'upbeat',
    spawn: { x: 17, y: 4 },
    tiles: [
      [0,0,0,0,0,0],[0,2,0,0,0,2],[0,0,5,5,0,0],
      [0,0,0,0,0,0],[0,2,0,0,0,2],[0,0,5,5,0,0],
      [0,0,0,0,0,0],[0,0,0,0,0,0],
    ]
  },
  'arcade': {
    x: 0, y: 8, width: 8, height: 6,
    bgColor: '#0a1a0a', floorColor: '#1b2d1b', music: 'energetic',
    spawn: { x: 4, y: 11 },
    tiles: [
      [0,0,2,0,0,0,0,2],
      [0,6,6,0,6,6,0,0],[0,6,6,0,6,6,0,0],
      [0,0,0,0,0,0,0,0],[0,2,0,0,0,0,2,0],
      [0,0,0,0,0,0,0,0],
    ]
  },
  'estudio': {
    x: 8, y: 8, width: 6, height: 6,
    bgColor: '#1a0a1a', floorColor: '#2d1b2d', music: 'neutral',
    spawn: { x: 11, y: 11 },
    tiles: [
      [0,0,2,2,0,0],[0,1,1,1,1,0],
      [0,0,4,4,0,0],[0,0,3,3,0,0],
      [0,1,1,1,1,0],[0,0,2,2,0,0],
    ]
  }
};

const world = { players: new Map() };

const CLIENT_COLORS = [
  '#e94560', '#4a69bd', '#78e08f', '#9b59b6',
  '#e58e26', '#e74c3c', '#1abc9c', '#3498db'
];

const clients = new Map(); // ws -> playerId
const wsToSession = new Map(); // ws -> sessionId

function log(level, msg, data = {}) {
  const ts = new Date().toISOString();
  console.log(JSON.stringify({ ts, level, msg, ...data }));
}

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

function getNearby(pid, radius = 3) {
  const p = world.players.get(pid);
  if (!p) return [];
  return Object.entries(world.players)
    .filter(([id, pl]) => {
      if (id === pid) return false;
      return Math.sqrt((pl.x - p.x)**2 + (pl.y - p.y)**2) <= radius;
    })
    .map(([id, pl]) => ({ id, name: pl.name, status: pl.status }));
}

function getAudioLevel(dist) {
  if (dist <= 0.5) return 1.0;
  if (dist <= 1.5) return 0.8;
  if (dist <= 3) return 0.4;
  return 0;
}

wss.on('connection', ws => {
  log('info', 'new_connection', { ip: ws._socket?.remoteAddress });
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw);
      
      // Message validation
      if (!msg.type || typeof msg.type !== 'string') return;
      
      // Sanitize text inputs
      if (msg.data?.name) msg.data.name = String(msg.data.name).slice(0, 16).replace(/[<>&'"]/g, '');
      if (msg.data?.text) msg.data.text = String(msg.data.text).slice(0, 200).replace(/[<>&'"]/g, '');
      
      handleMsg(ws, msg);
    } catch(e) {
      log('warn', 'invalid_message', { error: e.message });
    }
  });

  ws.on('close', () => {
    const pid = clients.get(ws);
    const sid = wsToSession.get(ws);
    if (pid) {
      // Don't remove from world immediately — session keeps player data
      world.players.delete(pid);
      clients.delete(ws);
      broadcast('player-left', { playerId: pid });
      log('info', 'player_disconnected', { playerId: pid, sessionId: sid });
    }
    wsToSession.delete(ws);
    rateLimiter.delete(ws);
  });

  ws.on('error', err => {
    log('error', 'ws_error', { error: err.message });
  });
});

function handleMsg(ws, msg) {
  const { type, data } = msg;
  const pid = clients.get(ws);
  const sid = wsToSession.get(ws);

  switch (type) {
    case 'reconnect': {
      // Resume session
      const sessionId = data?.sessionId;
      if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId);
        const existing = Array.from(world.players.values()).find(p => p.name === session.name);
        if (!existing) {
          world.players.set(session.playerId, {
            ...session, id: session.playerId, lastUpdate: Date.now()
          });
          clients.set(ws, session.playerId);
          wsToSession.set(ws, sessionId);
          
          ws.send(JSON.stringify({
            type: 'reconnected',
            data: { playerId: session.playerId, world: getPlayerState(), zones, sessionId }
          }));
          log('info', 'session_restored', { sessionId, playerId: session.playerId });
          break;
        }
      }
      // Fall through to join
    }
    case 'join': {
      const sessionId = sid || data?.sessionId || uuidv4().slice(0, 8);
      const id = uuidv4().slice(0, 8);
      const paletteIdx = world.players.size % CLIENT_COLORS.length;
      
      const player = {
        id, name: data?.name || `Player_${id}`,
        paletteIdx,
        x: 5, y: 4, zone: 'open-office',
        status: STATUS.AVAILABLE,
        frame: 0, facing: 1,
        lastUpdate: Date.now()
      };
      
      world.players.set(id, player);
      clients.set(ws, id);
      wsToSession.set(ws, sessionId);
      
      // Save session
      sessions.set(sessionId, { ...player, sessionId });
      
      ws.send(JSON.stringify({
        type: 'welcome',
        data: { playerId: id, world: getPlayerState(), zones, color: CLIENT_COLORS[paletteIdx], sessionId }
      }));
      
      broadcast('player-joined', player);
      log('info', 'player_joined', { playerId: id, name: player.name, sessionId });
      break;
    }

    case 'move': {
      const p = world.players.get(pid);
      if (!p || !data) break;
      
      const nx = Math.max(0, Math.min(19, data.x));
      const ny = Math.max(0, Math.min(16, data.y));
      let newZone = p.zone;
      
      for (const [zName, zone] of Object.entries(zones)) {
        const { x, y, width, height } = zone;
        if (nx >= x && nx < x + width && ny >= y && ny < y + height) {
          newZone = zName; break;
        }
      }
      
      if (nx !== p.x || ny !== p.y) {
        p.facing = data.x !== p.x ? (data.x > p.x ? 1 : -1) : p.facing;
        p.x = nx; p.y = ny; p.zone = newZone; p.lastUpdate = Date.now();
        
        const moveMsg = JSON.stringify({ type: 'player-moved', data: { playerId: pid, x: nx, y: ny, zone: newZone, facing: p.facing } });
        for (const [ws2, pid2] of clients) {
          if (pid2 !== pid && ws2.readyState === 1) {
            try { ws2.send(moveMsg); } catch(e) {}
          }
        }
        ws.send(JSON.stringify({ type: 'nearby', data: { players: getNearby(pid) } }));
      }
      break;
    }

    case 'status': {
      const p = world.players.get(pid);
      if (!p || !data?.status) break;
      if (!Object.values(STATUS).includes(data.status)) break;
      p.status = data.status;
      broadcast('player-status', { playerId: pid, status: p.status });
      // Update session
      const sessId = wsToSession.get(ws);
      if (sessId && sessions.has(sessId)) {
        sessions.set(sessId, { ...sessions.get(sessId), status: p.status });
      }
      break;
    }

    case 'chat': {
      const p = world.players.get(pid);
      if (!p || !data?.text) break;
      if (!checkRateLimit(ws)) {
        ws.send(JSON.stringify({ type: 'error', data: { code: 'RATE_LIMITED', message: 'Demasiados mensajes' } }));
        break;
      }
      const text = data.text.slice(0, 200);
      
      ws.send(JSON.stringify({ type: 'chat', data: { from: p.name, fromId: pid, text, zone: p.zone, timestamp: Date.now(), self: true } }));
      
      for (const [ws2, pid2] of clients) {
        if (pid2 !== pid) {
          const other = world.players.get(pid2);
          const dist = Math.sqrt((other.x - p.x)**2 + (other.y - p.y)**2);
          if (dist <= 3) {
            try {
              ws2.send(JSON.stringify({ type: 'chat', data: { from: p.name, fromId: pid, text, zone: p.zone, timestamp: Date.now(), audioLevel: getAudioLevel(dist) } }));
            } catch(e) {}
          }
        }
      }
      break;
    }

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', data: { ts: Date.now() } }));
      break;
  }
}

// Walk animation
setInterval(() => {
  for (const [, p] of world.players) {
    p.frame = (p.frame + 1) % 4;
  }
}, 150);

// Heartbeat
setInterval(() => {
  for (const [ws, pid] of clients) {
    if (!ws.isAlive) {
      const p = world.players.get(pid);
      const sessId = wsToSession.get(ws);
      if (sessId && sessions.has(sessId)) {
        // Keep session alive but mark offline
        const s = sessions.get(sessId);
        s.lastSeen = Date.now();
      }
      world.players.delete(pid);
      clients.delete(ws);
      if (p) broadcast('player-left', { playerId: pid });
      ws.terminate();
      log('warn', 'heartbeat_fail', { playerId: pid });
      continue;
    }
    ws.isAlive = false;
    try { ws.ping(); } catch(e) {}
  }
}, 30000);

// Cleanup old sessions (24h)
setInterval(() => {
  const now = Date.now();
  for (const [id, sess] of sessions) {
    if (now - (sess.lastSeen || sess.lastUpdate || 0) > 86400000) {
      sessions.delete(id);
      log('info', 'session_expired', { sessionId: id });
    }
  }
}, 3600000);

process.on('uncaughtException', err => {
  log('error', 'uncaught', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', err => {
  log('error', 'unhandled_rejection', { error: String(err) });
});

server.listen(PORT, () => {
  log('info', 'server_started', { port: PORT, env: process.env.NODE_ENV || 'development' });
});