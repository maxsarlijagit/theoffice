/**
 * The Office - Automated Test Suite
 * Tests against localhost sandbox server (matches actual server protocol).
 * Run: node tests/game.test.js
 *
 * Server message protocol:
 *   client → server:  { type: 'join', name, color }
 *   server → client:  { type: 'init', myId, players, tilemap, zones }
 *   server → all:     { type: 'state', players }
 *   client → server:  { type: 'input', keys: ['w','a','s','d'] }
 *   client → server:  { type: 'chat', message }
 *   server → clients: { type: 'chat', from, color, message, global, proximity? }
 *   client → server:  { type: 'heartbeat' }
 */

import { WebSocket } from 'ws';
import http from 'http';

const WS_URL  = process.env.WS_URL  || 'ws://localhost:3000';
const HTTP_URL = process.env.HTTP_URL || 'http://localhost:3000';

let passed = 0, failed = 0;

function test(name, fn) {
  return new Promise((resolve) => {
    Promise.resolve().then(() => fn()).then(() => {
      console.log('  ✅ ' + name);
      passed++;
    }).catch(e => {
      console.log('  ❌ ' + name + ': ' + e.message);
      failed++;
    }).then(resolve);
  });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

function wsConnect(timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const timer = setTimeout(() => { ws.close(); reject(new Error('WS connection timeout')); }, timeoutMs);
    ws.on('open', () => { clearTimeout(timer); resolve(ws); });
    ws.on('error', (e) => { clearTimeout(timer); ws.close(); reject(e); });
  });
}

/** Wait for a message matching predicate, returns parsed msg */
function waitForMessage(ws, predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Message timeout')), timeoutMs);
    const handler = (data) => {
      try {
        const msg = JSON.parse(data);
        if (predicate(msg)) {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve(msg);
        }
      } catch (_) {}
    };
    ws.on('message', handler);
  });
}

async function runTests() {
  console.log('\n🎮 The Office - Sandbox Test Suite\n');

  // ── REST Endpoints ──────────────────────────────────────────────

  await test('GET /health returns { status: "ok" }', async () => {
    const data = await fetchJson(HTTP_URL + '/health');
    if (data.status !== 'ok') throw new Error('Expected status "ok", got: ' + data.status);
  });

  await test('GET /stats returns { players: <number> }', async () => {
    const data = await fetchJson(HTTP_URL + '/stats');
    if (typeof data.players !== 'number') throw new Error('Expected numeric players, got: ' + JSON.stringify(data));
  });

  // ── WebSocket Connection ─────────────────────────────────────────

  await test('WebSocket connects', async () => {
    const ws = await wsConnect();
    ws.close();
  });

  // ── Join Flow ────────────────────────────────────────────────────

  await test('Join receives init with myId, tilemap, zones', async () => {
    const ws = await wsConnect();
    try {
      const initPromise = waitForMessage(ws, m => m.type === 'init');
      ws.send(JSON.stringify({ type: 'join', name: 'TestBot', color: '#ff6600' }));
      const msg = await initPromise;
      if (!msg.myId)    throw new Error('Missing myId in init');
      if (!msg.tilemap) throw new Error('Missing tilemap in init');
      if (!msg.zones)   throw new Error('Missing zones in init');
      if (typeof msg.myId !== 'string') throw new Error('myId should be a string UUID');
    } finally {
      ws.close();
    }
  });

  await test('Tilemap dimensions are 36x23', async () => {
    const ws = await wsConnect();
    try {
      const initPromise = waitForMessage(ws, m => m.type === 'init');
      ws.send(JSON.stringify({ type: 'join', name: 'TilemapBot', color: '#00ff00' }));
      const msg = await initPromise;
      const { tilemap } = msg;
      if (!Array.isArray(tilemap)) throw new Error('Tilemap is not an array');
      if (tilemap.length !== 23) throw new Error(`Expected 23 rows, got ${tilemap.length}`);
      for (let i = 0; i < tilemap.length; i++) {
        if (tilemap[i].length !== 36)
          throw new Error(`Row ${i} has ${tilemap[i].length} cols (expected 36)`);
      }
    } finally {
      ws.close();
    }
  });

  await test('Zones include all 5 expected zones', async () => {
    const ws = await wsConnect();
    try {
      const initPromise = waitForMessage(ws, m => m.type === 'init');
      ws.send(JSON.stringify({ type: 'join', name: 'ZoneBot', color: '#0099ff' }));
      const msg = await initPromise;
      const expectedZones = ['OFFICE', 'FOCUS_ROOM', 'CAFETERIA', 'ARCADE', 'STUDIO'];
      for (const z of expectedZones) {
        if (!msg.zones[z]) throw new Error(`Missing zone: ${z}`);
      }
    } finally {
      ws.close();
    }
  });

  // ── State Broadcast ──────────────────────────────────────────────

  await test('Server broadcasts state with player data', async () => {
    const ws = await wsConnect();
    try {
      const statePromise = waitForMessage(ws, m => m.type === 'state');
      ws.send(JSON.stringify({ type: 'join', name: 'StateBot', color: '#cc00cc' }));
      const msg = await statePromise;
      if (!Array.isArray(msg.players)) throw new Error('players should be array');
      const me = msg.players.find(p => p.name === 'StateBot');
      if (!me) throw new Error('Own player not found in state');
      if (typeof me.x !== 'number') throw new Error('Player x should be a number');
      if (typeof me.y !== 'number') throw new Error('Player y should be a number');
    } finally {
      ws.close();
    }
  });

  // ── Input / Movement ─────────────────────────────────────────────

  await test('Input message is accepted without error', async () => {
    const ws = await wsConnect();
    try {
      // Join first
      const initPromise = waitForMessage(ws, m => m.type === 'init');
      ws.send(JSON.stringify({ type: 'join', name: 'MoveBot', color: '#ffcc00' }));
      await initPromise;
      // Send input
      ws.send(JSON.stringify({ type: 'input', keys: ['w'] }));
      // Wait for next state broadcast (≤ 100ms at 20 ticks/s)
      await waitForMessage(ws, m => m.type === 'state', 3000);
    } finally {
      ws.close();
    }
  });

  // ── Chat ─────────────────────────────────────────────────────────

  await test('Chat message is echoed back as global', async () => {
    const ws = await wsConnect();
    try {
      const initPromise = waitForMessage(ws, m => m.type === 'init');
      ws.send(JSON.stringify({ type: 'join', name: 'ChatBot', color: '#00ccff' }));
      await initPromise;

      const chatPromise = waitForMessage(ws, m => m.type === 'chat' && m.global === true && m.from === 'ChatBot');
      ws.send(JSON.stringify({ type: 'chat', message: 'hello world' }));
      const msg = await chatPromise;
      if (msg.message !== 'hello world') throw new Error('Chat message mismatch');
    } finally {
      ws.close();
    }
  });

  // ── Heartbeat ────────────────────────────────────────────────────

  await test('Heartbeat is accepted without disconnect', async () => {
    const ws = await wsConnect();
    try {
      const initPromise = waitForMessage(ws, m => m.type === 'init');
      ws.send(JSON.stringify({ type: 'join', name: 'HeartBot', color: '#ff3366' }));
      await initPromise;
      // Send heartbeat and verify connection stays open
      ws.send(JSON.stringify({ type: 'heartbeat' }));
      await new Promise(r => setTimeout(r, 500));
      if (ws.readyState !== WebSocket.OPEN) throw new Error('WS closed after heartbeat');
    } finally {
      ws.close();
    }
  });

  // ── Player Count ─────────────────────────────────────────────────

  await test('/stats player count increases when player joins', async () => {
    await new Promise(r => setTimeout(r, 200)); // wait for previous test to disconnect
    const before = (await fetchJson(HTTP_URL + '/stats')).players;
    const ws = await wsConnect();
    const initPromise = waitForMessage(ws, m => m.type === 'init');
    ws.send(JSON.stringify({ type: 'join', name: 'CountBot', color: '#009999' }));
    await initPromise;
    await new Promise(r => setTimeout(r, 100));
    const after = (await fetchJson(HTTP_URL + '/stats')).players;
    ws.close();
    if (after <= before) throw new Error(`Expected players to increase (${before} → ${after})`);
  });

  // ── Summary ──────────────────────────────────────────────────────

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});