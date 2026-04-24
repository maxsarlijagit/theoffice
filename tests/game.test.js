/**
 * The Office - Automated Test Suite
 * Run: npm install ws && node tests/game.test.js
 */

const { WebSocket } = require('ws');
const https = require('https');
const http = require('http');

const WS_URL = process.env.WS_URL || 'wss://theoffice-production.up.railway.app';
const HTTP_URL = process.env.HTTP_URL || 'https://theoffice-production.up.railway.app';

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
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

function wsConnect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const timer = setTimeout(() => { ws.close(); reject(new Error('WS timeout')); }, 5000);
    ws.on('open', () => { clearTimeout(timer); resolve(ws); });
    ws.on('error', (e) => { clearTimeout(timer); ws.close(); reject(e); });
  });
}

async function runTests() {
  console.log('\n🎮 The Office - Test Suite\n');

  await test('Health endpoint', async () => {
    const data = await fetchJson(HTTP_URL + '/health');
    if (data.status !== 'ok') throw new Error('status: ' + data.status);
  });

  await test('Stats endpoint', async () => {
    const data = await fetchJson(HTTP_URL + '/stats');
    if (typeof data.players !== 'number') throw new Error('missing players');
  });

  await test('WebSocket connects', async () => {
    const ws = await wsConnect();
    ws.close();
  });

  await test('Join receives welcome with playerId and zones', async () => {
    const ws = await wsConnect();
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { ws.close(); reject(new Error('no welcome')); }, 5000);
      ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.type === 'welcome') {
          clearTimeout(timer);
          if (!msg.data.playerId) reject(new Error('no playerId'));
          if (!msg.data.zones) reject(new Error('no zones'));
          ws.close();
          resolve();
        }
      });
      ws.send(JSON.stringify({ type: 'join', data: { name: 'TestBot' } }));
    });
  });

  await test('Move is processed', async () => {
    const ws = await wsConnect();
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { ws.close(); reject(new Error('no response')); }, 5000);
      ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.type === 'welcome') {
          ws.send(JSON.stringify({ type: 'move', data: { x: 7, y: 5 } }));
        }
        if (msg.type === 'nearby') {
          clearTimeout(timer);
          ws.close();
          resolve();
        }
      });
      ws.send(JSON.stringify({ type: 'join', data: { name: 'MoveBot' } }));
    });
  });

  await test('Chat is broadcast', async () => {
    const ws = await wsConnect();
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { ws.close(); reject(new Error('no chat response')); }, 5000);
      ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.type === 'chat' && msg.data.text === 'test message') {
          clearTimeout(timer);
          ws.close();
          resolve();
        }
      });
      ws.send(JSON.stringify({ type: 'join', data: { name: 'ChatTest' } }));
      setTimeout(() => ws.send(JSON.stringify({ type: 'chat', data: { text: 'test message' } })), 500);
    });
  });

  await test('Status change works', async () => {
    const ws = await wsConnect();
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { ws.close(); reject(new Error('no status response')); }, 5000);
      ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.type === 'player-status' && msg.data.status === 'focus') {
          clearTimeout(timer);
          ws.close();
          resolve();
        }
      });
      ws.send(JSON.stringify({ type: 'join', data: { name: 'StatusTest' } }));
      setTimeout(() => ws.send(JSON.stringify({ type: 'status', data: { status: 'focus' } })), 500);
    });
  });

  console.log('\n📊 Results: ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});