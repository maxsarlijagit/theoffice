import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';

const PORT = process.env.PORT || 3000;
const wss = new WebSocketServer({ port: PORT });

// Estado del mundo
const world = {
  players: new Map(), // id -> { x, y, name, color, zone }
  zones: {
    'open-office': { x: 0, y: 0, width: 10, height: 8, music: 'lofi', spawn: { x: 5, y: 4 } },
    'focus-room': { x: 10, y: 0, width: 4, height: 4, music: 'silence', spawn: { x: 12, y: 2 } },
    'cafeteria': { x: 14, y: 0, width: 6, height: 8, music: 'upbeat', spawn: { x: 17, y: 4 } },
    'arcade': { x: 0, y: 8, width: 8, height: 6, music: 'energetic', spawn: { x: 4, y: 11 } },
    'estudio': { x: 8, y: 8, width: 6, height: 6, music: 'neutral', spawn: { x: 11, y: 11 } }
  }
};

// Conexiones WebSocket
const clients = new Map(); // ws -> playerId

function broadcast(type, data, excludeWs = null) {
  const msg = JSON.stringify({ type, data });
  for (const [ws, pid] of clients) {
    if (ws !== excludeWs && ws.readyState === 1) {
      ws.send(msg);
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

wss.on('connection', (ws) => {
  console.log('🔌 Nueva conexión');

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
      world.players.delete(playerId);
      clients.delete(ws);
      broadcast('player-left', { playerId });
      console.log(`👋 Player desconectado: ${playerId}`);
    }
  });
});

function handleMessage(ws, msg) {
  const { type, data } = msg;

  switch (type) {
    case 'join': {
      const playerId = uuidv4().slice(0, 8);
      const player = {
        id: playerId,
        name: data.name || `Player_${playerId}`,
        color: data.color || '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
        x: 5,
        y: 4,
        zone: 'open-office',
        lastUpdate: Date.now()
      };
      world.players.set(playerId, player);
      clients.set(ws, playerId);
      
      ws.send(JSON.stringify({
        type: 'welcome',
        data: { playerId, world: getPlayerState(), zones: world.zones }
      }));
      
      broadcast('player-joined', player);
      console.log(`👤 Player joined: ${player.name} (${playerId})`);
      break;
    }

    case 'move': {
      const playerId = clients.get(ws);
      const player = world.players.get(playerId);
      if (player && data) {
        let newZone = player.zone;
        
        // Detectar zona por posición
        for (const [zoneName, zone] of Object.entries(world.zones)) {
          const { x, y, width, height, spawn } = zone;
          if (data.x >= x && data.x < x + width && data.y >= y && data.y < y + height) {
            newZone = zoneName;
            break;
          }
        }
        
        player.x = data.x;
        player.y = data.y;
        player.zone = newZone;
        player.lastUpdate = Date.now();
        
        broadcast('player-moved', { playerId, x: data.x, y: data.y, zone: newZone });
      }
      break;
    }

    case 'ping': {
      ws.send(JSON.stringify({ type: 'pong', data: { ts: Date.now() } }));
      break;
    }
  }
}

console.log(`🚀 Servidor corriendo en ws://localhost:${PORT}`);