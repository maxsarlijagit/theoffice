import Phaser from 'phaser';
import { generateAvatar } from './spriteGenerator.js';

// ── Isometric projection constants ──────────────────────────────────────────
const TILE_W = 64;   // horizontal span of one diamond tile (px)
const TILE_H = 32;   // vertical span of one diamond tile (px)
const GRID_SIZE = 32;

// Offset so all screen-X values stay ≥ 0:
//   tile(0,0)  → screen(ORIGIN_X, 0)
//   tile(0,31) → screen(0, 496)       (leftmost)
//   tile(31,0) → screen(1984, 496)    (rightmost)
const ORIGIN_X = (GRID_SIZE - 1) * (TILE_W / 2); // 992

// Full texture dimensions for the baked static map
const MAP_TEX_W = (GRID_SIZE - 1) * TILE_W + TILE_W;   // 2048
const MAP_TEX_H = (GRID_SIZE - 1) * TILE_H + TILE_H;   // 1024

function gridToScreen(gx, gy) {
  return {
    x: (gx - gy) * (TILE_W / 2) + ORIGIN_X,
    y: (gx + gy) * (TILE_H / 2),
  };
}

// ── Shared mutable state (WS ↔ Phaser) ──────────────────────────────────────
let ws = null;
let mapData = null;
let serverPlayers = [];
let myId = null;
let game = null;
let activeScene = null;
const pressedKeys = new Set();
let reconnectAttempts = 0;
let joinParams = null;

// =====================================================================
// ── PANTALLA DE CARGA (PreloaderScene) ────────────────────────────
// =====================================================================
class PreloaderScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloaderScene' });
  }

  init(data) {
    // Guardamos los datos que manda el WebSocket (mapa, jugadores, ID)
    // para pasárselos a la escena isométrica cuando termine de cargar.
    this.wsData = data;
  }

  preload() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // UI: Texto de carga
    const loadingText = this.make.text({
        x: width / 2,
        y: height / 2 - 50,
        text: 'Cargando The Office...',
        style: { fontFamily: '"JetBrains Mono", monospace', fontSize: '20px', fill: '#ffffff' }
    });
    loadingText.setOrigin(0.5, 0.5);

    // UI: Contenedor y barra de progreso
    const progressBox = this.add.graphics();
    const progressBar = this.add.graphics();
    
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 20, 320, 40);

    // Eventos de carga
    this.load.on('progress', (value) => {
        progressBar.clear();
        progressBar.fillStyle(0x534AB7, 1); // Violeta de The Office
        progressBar.fillRect(width / 2 - 150, height / 2 - 10, 300 * value, 20);
    });

    // --- ORIGINAL (Descomentar para producción) ---
    // this.load.on('complete', () => {
    //     progressBar.destroy();
    //     progressBox.destroy();
    //     loadingText.destroy();
        
    //     // Pasamos a la escena principal enviando los datos del servidor intactos
    //     this.scene.start('IsoScene', this.wsData);
    // });

    // --- TEST MODE: Delay de 3 segundos ---
    this.load.on('complete', () => {
        // Aprovechamos para darle feedback visual de que ya cargó todo
        loadingText.setText('¡Listo! Abriendo puertas...');
        
        // El progreso ya está en 1 (100%), lo dejamos ahí un ratito

        // Retrasamos el inicio de la siguiente escena por 3000 milisegundos (3 segundos)
        this.time.delayedCall(3000, () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
            
            // Pasamos a la escena principal enviando los datos del servidor intactos
            this.scene.start('IsoScene', this.wsData);
        });
    });

    // Carga de tu Texture Atlas
    this.load.atlas('office_sprites', 'assets/sprites/atlas.png', 'assets/sprites/atlas.json');
  }
}

// ── Phaser Scene ─────────────────────────────────────────────────────────────
class IsoScene extends Phaser.Scene {
  constructor() {
    super({ key: 'IsoScene' });
    this.playerObjects = new Map(); // id → { container, body, nameLabel, data }
  }

  init(data) {
    mapData = data.mapData;
    serverPlayers = data.players;
    myId = data.myId;
    activeScene = this;
    this.frameIndex = 0;
    this.lastFrameTime = 0;
  }

  create() {
    this.buildMap();
    this.buildWalls();
    this.setupCamera();
    serverPlayers.forEach(p => this.addPlayer(p));

    // Keep bounds/zoom correct on window resize
    this.scale.on('resize', () => this.setupCamera());
  }

  buildMap() {
    const { tiles, areaStyles } = mapData;

    // Painter's algorithm: lower (x+y) tiles drawn first (appear behind)
    const sorted = [...tiles].sort((a, b) => (a.x + a.y) - (b.x + b.y));

    const g = this.add.graphics().setDepth(-10);

    sorted.forEach(tile => {
      const { x: sx, y: sy } = gridToScreen(tile.x, tile.y);
      const hex = (areaStyles[tile.area]?.color ?? '#444444').replace('#', '');
      const color = parseInt(hex, 16);

      // Top-face fill (two triangles = full diamond)
      g.fillStyle(color, 1.0);
      g.fillTriangle(
        sx,           sy,
        sx + TILE_W / 2, sy + TILE_H / 2,
        sx - TILE_W / 2, sy + TILE_H / 2
      );
      g.fillTriangle(
        sx + TILE_W / 2, sy + TILE_H / 2,
        sx,              sy + TILE_H,
        sx - TILE_W / 2, sy + TILE_H / 2
      );

      // Subtle diamond outline
      g.lineStyle(1, 0x000000, 0.12);
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(sx + TILE_W / 2, sy + TILE_H / 2);
      g.lineTo(sx, sy + TILE_H);
      g.lineTo(sx - TILE_W / 2, sy + TILE_H / 2);
      g.closePath();
      g.strokePath();
    });
  }

  buildWalls() {
    const walls = mapData.walls;
    if (!walls?.length) return;

    // Wall face colors from the generateWallTile() palette
    const WALL_H = 22;   // wall height in screen pixels
    const C_LIGHT = 0x475569; // wallHighlight — NW/NE faces (face viewer)
    const C_MID   = 0x3d5070; // NE face (slightly different angle)
    const C_DARK  = 0x2d3d4e; // SE/SW faces (face away)

    // Single graphics layer above floor (-10) but below players (gx+gy+1)
    const g = this.add.graphics().setDepth(0);

    // Painter's algorithm — draw back-to-front
    const sorted = [...walls].sort((a, b) => (a.x + a.y) - (b.x + b.y));

    sorted.forEach(({ x: gx, y: gy, edge }) => {
      const { x: sx, y: sy } = gridToScreen(gx, gy);

      // Diamond vertex positions for tile (gx,gy)
      //  T = top, R = right, B = bottom, L = left
      const T = { x: sx,              y: sy              };
      const R = { x: sx + TILE_W / 2, y: sy + TILE_H / 2 };
      const B = { x: sx,              y: sy + TILE_H      };
      const L = { x: sx - TILE_W / 2, y: sy + TILE_H / 2 };

      // Mapping: 2D grid edge → isometric diamond edge → face colour
      //  "left"   → NW edge (T↔L) — faces viewer
      //  "top"    → NE edge (T↔R) — faces viewer (slightly)
      //  "right"  → SE edge (R↔B) — faces away
      //  "bottom" → SW edge (L↔B) — faces away
      let p1, p2, faceColor, topColor;
      switch (edge) {
        case 'left':   p1 = T; p2 = L; faceColor = C_LIGHT; topColor = 0x5a7a96; break;
        case 'top':    p1 = T; p2 = R; faceColor = C_MID;   topColor = 0x526e88; break;
        case 'right':  p1 = R; p2 = B; faceColor = C_DARK;  topColor = null;     break;
        case 'bottom': p1 = L; p2 = B; faceColor = C_DARK;  topColor = null;     break;
        default: return;
      }

      // Wall face parallelogram (floor edge extruded up by WALL_H)
      g.fillStyle(faceColor, 1.0);
      g.fillPoints([
        { x: p1.x, y: p1.y - WALL_H },
        { x: p2.x, y: p2.y - WALL_H },
        { x: p2.x, y: p2.y },
        { x: p1.x, y: p1.y },
      ], true);

      // Top cap — flat diamond face on top of wall (only on viewer-facing edges)
      if (topColor !== null) {
        g.fillStyle(topColor, 1.0);
        const dx = edge === 'left' ? TILE_W / 2 : -TILE_W / 2;
        g.fillPoints([
          { x: p1.x,      y: p1.y - WALL_H },
          { x: p2.x,      y: p2.y - WALL_H },
          { x: p2.x + dx, y: p2.y - WALL_H - TILE_H / 2 },
          { x: p1.x + dx, y: p1.y - WALL_H - TILE_H / 2 },
        ], true);
      }

      // Highlight along top edge of wall face (brick mortar feel)
      g.lineStyle(1, 0x7fa8c8, 0.55);
      g.beginPath();
      g.moveTo(p1.x, p1.y - WALL_H);
      g.lineTo(p2.x, p2.y - WALL_H);
      g.strokePath();

      // Shadow along floor seam
      g.lineStyle(1, 0x000000, 0.25);
      g.beginPath();
      g.moveTo(p1.x, p1.y);
      g.lineTo(p2.x, p2.y);
      g.strokePath();
    });
  }

  setupCamera() {
    const cam   = this.cameras.main;
    const vw    = this.scale.width;
    const vh    = this.scale.height;

    // True content extent: diamonds overhang TILE_W/2 on each side of the grid
    const PAD      = 56;
    const contentX = -TILE_W / 2;                    // -32
    const contentY = 0;
    const contentW = MAP_TEX_W;                       // 2048
    const contentH = MAP_TEX_H;                       // 1024
    const mapCX    = contentX + contentW / 2;         // 992
    const mapCY    = contentY + contentH / 2;         // 512

    // Fit zoom — constrained by whichever axis needs the most room
    const fitZoom = Math.min(
      vw / (contentW + PAD * 2),
      vh / (contentH + PAD * 2),
    ) * 0.95;

    // Bounds sized to exactly fit the viewport at fitZoom, centered on the
    // map center, so setBounds locks the camera to the map middle.
    const visW    = vw / fitZoom;
    const visH    = vh / fitZoom;
    cam.setBounds(mapCX - visW / 2, mapCY - visH / 2, visW, visH);

    cam.setZoom(fitZoom);
    this.scrollTo(cam, mapCX, mapCY);
  }

  // Phaser's centerOn() is only correct at zoom=1; this places (wx,wy) at
  // the viewport center for any zoom level.
  scrollTo(cam, wx, wy) {
    cam.scrollX = wx - cam.width  / (2 * cam.zoom);
    cam.scrollY = wy - cam.height / (2 * cam.zoom);
  }

  // ── Player management ────────────────────────────────────────────────────

  // Returns a Phaser texture key for the given avatar parameters, generating
  // and caching the texture from the pixel-art spriteGenerator on first use.
  getAvatarTexture(color, type, direction, frame) {
    const key = `av_${color}_${type}_${direction}_${frame}`;
    if (!this.textures.exists(key)) {
      const canvas = generateAvatar(color, 0, frame, direction, type);
      this.textures.addCanvas(key, canvas);
    }
    return key;
  }

  addPlayer(pData) {
    if (this.playerObjects.has(pData.id)) return;

    const pos = gridToScreen(pData.x, pData.y);
    const container = this.add.container(pos.x, pos.y + TILE_H / 2);
    container.setDepth(pData.x + pData.y + 1);

    const texKey = this.getAvatarTexture(
      pData.color, pData.avatarType || 0, pData.direction || 'S', 0
    );
    // Scale 2× so the 16×16 sprite fills ~32px, visible against 64px-wide tiles.
    const sprite = this.add.image(0, -4, texKey)
      .setScale(2)
      .setOrigin(0.5, 1);

    const nameLabel = this.add.text(0, 4, pData.name, {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '7px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5, 0);

    container.add([sprite, nameLabel]);

    this.playerObjects.set(pData.id, {
      container,
      sprite,
      nameLabel,
      data: { ...pData },
    });
  }

  removePlayer(playerId) {
    const obj = this.playerObjects.get(playerId);
    if (obj) {
      obj.container.destroy();
      this.playerObjects.delete(playerId);
    }
  }

  // Called every server state broadcast
  applyServerState(players) {
    const liveIds = new Set(players.map(p => p.id));

    players.forEach(sp => {
      if (!this.playerObjects.has(sp.id)) {
        this.addPlayer(sp);
      } else {
        const obj = this.playerObjects.get(sp.id);
        obj.data.x = sp.x;
        obj.data.y = sp.y;
        obj.data.zone = sp.zone;
        obj.data.direction = sp.direction || obj.data.direction;
        obj.data.avatarType = sp.avatarType ?? obj.data.avatarType;
        obj.container.setDepth(sp.x + sp.y + 1);
      }
    });

    this.playerObjects.forEach((_, id) => {
      if (!liveIds.has(id)) this.removePlayer(id);
    });

    // Update zone HUD for local player
    const me = players.find(p => p.id === myId);
    if (me) {
      const prevZone = document.getElementById('zone-name').dataset.zone;
      if (me.zone !== prevZone) showZoneChange(me.zone);
    }
  }

  spawnChatBubble(playerId, text) {
    const obj = this.playerObjects.get(playerId);
    if (!obj) return;

    const bubble = this.add.text(obj.container.x, obj.container.y - 30, text, {
      fontFamily: '"Space Grotesk", sans-serif',
      fontSize: '8px',
      color: '#000000',
      backgroundColor: '#ffffffee',
      padding: { x: 5, y: 3 },
    }).setOrigin(0.5, 1).setDepth(1000);

    this.tweens.add({
      targets: bubble,
      alpha: 0,
      delay: 3500,
      duration: 500,
      onComplete: () => bubble.destroy(),
    });
  }

  update() {
    // Advance walk animation at 150 ms / frame (matches original)
    const now = this.time.now;
    if (now - this.lastFrameTime > 150) {
      this.frameIndex = (this.frameIndex + 1) % 4;
      this.lastFrameTime = now;
    }

    // Lerp each player to their target grid position + update sprite texture
    this.playerObjects.forEach(obj => {
      const target = gridToScreen(obj.data.x, obj.data.y);
      const ty = target.y + TILE_H / 2;
      obj.container.x += (target.x - obj.container.x) * 0.3;
      obj.container.y += (ty - obj.container.y) * 0.3;

      // Only animate the local player while a key is held (matches original behaviour)
      const isMoving = obj.data.id === myId && pressedKeys.size > 0;
      const frame = isMoving ? this.frameIndex : 0;
      const texKey = this.getAvatarTexture(
        obj.data.color, obj.data.avatarType || 0, obj.data.direction || 'S', frame
      );
      if (obj.sprite.texture.key !== texKey) obj.sprite.setTexture(texKey);
    });

    renderMinimap();
  }
}

// ── WebSocket ─────────────────────────────────────────────────────────────────

function connectWS(name, color, avatarType, sessionId) {
  joinParams = { name, color, avatarType, sessionId };
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}/ws`);

  ws.onopen = () => {
    reconnectAttempts = 0;
    document.getElementById('status-overlay').classList.remove('visible');
    ws.send(JSON.stringify({ type: 'join', name, color, avatarType, sessionId }));
  };

  ws.onmessage = e => handleMessage(JSON.parse(e.data));

  ws.onclose = () => {
    document.getElementById('status-overlay').classList.add('visible');
    if (reconnectAttempts < 10 && joinParams) {
      const delay = Math.min(5000, 1000 * Math.pow(1.5, reconnectAttempts++));
      setTimeout(() => connectWS(...Object.values(joinParams)), delay);
    } else {
      document.getElementById('status-overlay').textContent =
        'Connection lost. Please refresh.';
    }
  };
}

function sendInput() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'input', keys: Array.from(pressedKeys) }));
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'init': {
      myId = msg.myId;
      localStorage.setItem('theoffice_session', myId);
      mapData = msg.map;
      serverPlayers = msg.players;

      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('game-ui').style.display = 'block';

      // Boot Phaser on first init; restart scene on reconnect
      if (!game) {
        game = new Phaser.Game({
          type: Phaser.AUTO,
          parent: 'canvas-container',
          width: window.innerWidth,
          height: window.innerHeight,
          backgroundColor: '#0d1117',
          pixelArt: true,
          // INICIAMOS PRIMERO EN LA PANTALLA DE CARGA
          scene: [PreloaderScene, IsoScene], 
          scale: {
            mode: Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.CENTER_BOTH,
          },
        });
        // Le pasamos los datos del WS a la PreloaderScene
        game.scene.start('PreloaderScene', { mapData, players: msg.players, myId });
      } else {
        game.scene.restart('PreloaderScene');
        game.scene.start('PreloaderScene', { mapData, players: msg.players, myId });
      }

      renderMinimap();
      break;
    }

    case 'state': {
      serverPlayers = msg.players;
      if (activeScene && activeScene.scene.key === 'IsoScene') activeScene.applyServerState(msg.players);
      document.getElementById('player-count').textContent =
        `${msg.players.length} online`;
      break;
    }

    case 'player_joined':
      if (activeScene && activeScene.scene.key === 'IsoScene') activeScene.addPlayer(msg.player);
      break;

    case 'player_left':
      if (activeScene && activeScene.scene.key === 'IsoScene') activeScene.removePlayer(msg.playerId);
      break;

    case 'zone_enter':
      if (msg.playerId === myId) showZoneChange(msg.zone);
      break;

    case 'chat':
      if (msg.global) addChatMessage(msg.from, msg.color, msg.message);
      if (msg.proximity && activeScene && activeScene.scene.key === 'IsoScene' && msg.playerId) {
        activeScene.spawnChatBubble(msg.playerId, msg.message);
      }
      break;
  }
}

// ── Minimap (top-down grid view) ──────────────────────────────────────────────
function renderMinimap() {
  const canvas = document.getElementById('minimap');
  if (!canvas || !mapData) return;
  const ctx = canvas.getContext('2d');
  canvas.width = GRID_SIZE;
  canvas.height = GRID_SIZE;

  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, GRID_SIZE, GRID_SIZE);

  mapData.tiles.forEach(t => {
    ctx.fillStyle = mapData.areaStyles[t.area]?.color ?? '#444';
    ctx.fillRect(t.x, t.y, 1, 1);
  });

  serverPlayers.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 2, 2);
  });

  const me = serverPlayers.find(p => p.id === myId);
  if (me) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(me.x - 1, me.y - 1, 3, 3);
    ctx.fillStyle = me.color;
    ctx.fillRect(me.x, me.y, 1, 1);
  }
}

// ── Zone HUD ──────────────────────────────────────────────────────────────────
function showZoneChange(zone) {
  const color = mapData?.areaStyles?.[zone]?.color ?? '#3b82f6';
  const nameEl = document.getElementById('zone-name');
  const dotEl = document.getElementById('zone-indicator');
  const displayName = zone?.replace(/_/g, ' ') ?? 'UNKNOWN';

  nameEl.textContent = displayName;
  nameEl.style.color = color;
  nameEl.dataset.zone = zone;
  dotEl.style.background = color;

  const notif = document.getElementById('zone-notification');
  notif.textContent = displayName;
  notif.classList.add('visible');
  setTimeout(() => notif.classList.remove('visible'), 1500);
}

// ── Chat UI ───────────────────────────────────────────────────────────────────
function addChatMessage(from, color, text) {
  const box = document.getElementById('chat-messages');
  if (!box) return;
  const div = document.createElement('div');
  div.className = 'chat-message global';
  div.innerHTML =
    `<div class="sender" style="color:${color}">${from}</div>` +
    `<div class="text">${text}</div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  while (box.children.length > 50) box.removeChild(box.firstChild);
}

// ── Login & avatar preview ────────────────────────────────────────────────────
let selectedColor = '#3b82f6';

window.addEventListener('load', () => {
  const prefs = localStorage.getItem('theoffice_prefs');
  if (prefs) {
    try {
      const d = JSON.parse(prefs);
      document.getElementById('name-input').value = d.name ?? '';
      document.getElementById('avatar-type').value = d.avatarType ?? 0;
      selectedColor = d.color ?? '#3b82f6';
    } catch {}
  }

  if (window.iro) {
    const picker = new iro.ColorPicker('#color-wheel', {
      width: 100,
      color: selectedColor,
      layout: [{ component: iro.ui.Wheel, options: { wheelLightness: true } }],
    });
    picker.on('color:change', c => {
      selectedColor = c.hexString;
      drawAvatarPreview();
    });
  }

  drawAvatarPreview();
});

function drawAvatarPreview() {
  const canvas = document.getElementById('avatar-preview-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const type = parseInt(document.getElementById('avatar-type')?.value ?? '0', 10);
  const sprite = generateAvatar(selectedColor, 0, 0, 'S', type);
  ctx.clearRect(0, 0, 64, 64);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, 0, 0, 64, 64);
}

document.getElementById('avatar-type')?.addEventListener('change', drawAvatarPreview);

document.getElementById('join-btn')?.addEventListener('click', joinGame);
document.getElementById('name-input')?.addEventListener('keypress', e => {
  if (e.key === 'Enter') joinGame();
});

function joinGame() {
  const name = document.getElementById('name-input').value.trim() || 'Anonymous';
  const avatarType = parseInt(document.getElementById('avatar-type').value, 10) || 0;
  localStorage.setItem('theoffice_prefs', JSON.stringify({ name, color: selectedColor, avatarType }));
  connectWS(name, selectedColor, avatarType, localStorage.getItem('theoffice_session') || null);
}

// ── Keyboard input (DOM level, not Phaser) ───────────────────────────────────
const KEY_MAP = {
  w: 'w', ArrowUp: 'w',
  s: 's', ArrowDown: 's',
  a: 'a', ArrowLeft: 'a',
  d: 'd', ArrowRight: 'd',
};

document.addEventListener('keydown', e => {
  if (document.activeElement.tagName === 'INPUT') return;
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('quick-chat-input')?.focus();
    return;
  }
  const k = KEY_MAP[e.key];
  if (k && !pressedKeys.has(k)) { pressedKeys.add(k); sendInput(); }
});

document.addEventListener('keyup', e => {
  if (document.activeElement.tagName === 'INPUT') return;
  const k = KEY_MAP[e.key];
  if (k) { pressedKeys.delete(k); sendInput(); }
});

// ── Chat panel / quick chat ───────────────────────────────────────────────────
document.getElementById('chat-toggle')?.addEventListener('click', () => {
  document.getElementById('chat-panel').classList.toggle('visible');
});

document.getElementById('chat-input')?.addEventListener('keypress', e => {
  if (e.key !== 'Enter') return;
  const text = e.target.value.trim();
  if (text && ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'chat', message: text }));
    e.target.value = '';
  }
});

document.getElementById('quick-chat-input')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const text = e.target.value.trim();
    if (text && ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'chat', message: text }));
      e.target.value = '';
    }
    e.target.blur();
  } else if (e.key === 'Escape') {
    e.target.blur();
  }
});

// ── Heartbeat ─────────────────────────────────────────────────────────────────
setInterval(() => {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'heartbeat' }));
  }
}, 10000);