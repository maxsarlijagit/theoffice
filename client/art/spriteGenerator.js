// Procedural sprite generator for The Office
// Generates 16x16 pixel art sprites using Canvas 2D

// Color palette
const PALETTE = {
  background: '#0d1117',
  floor: '#1e293b',
  floorDark: '#0f172a',
  wall: '#334155',
  wallHighlight: '#475569',
  chair: '#92400e',
  chairDark: '#78350f',
  monitor: '#3b82f6',
  monitorFrame: '#1e3a5f',
  monitorGlow: '#60a5fa',
  plant: '#22c55e',
  plantDark: '#15803d',
  plantPot: '#a16207',
  table: '#065f46',
  tableLight: '#0d9488',
};

// Seeded random
function seededRandom(seed) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

// Dithering helper
function drawDitheredRect(ctx, x, y, w, h, color1, color2, seed, pattern = 0.5) {
  ctx.fillStyle = color1;
  ctx.fillRect(x, y, w, h);
  
  ctx.fillStyle = color2;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      if (seededRandom(seed + py * 10 + px) < pattern) {
        ctx.fillRect(x + px, y + py, 1, 1);
      }
    }
  }
}

// Generate avatar sprite with animation frame (16x16)
export function generateAvatar(color, seed, frame = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  
  // Bobbing effect while walking
  const offsetY = frame > 0 ? Math.sin(frame * Math.PI / 2) * 1 : 0;
  
  // Body
  ctx.fillStyle = color;
  ctx.fillRect(3, 4 + offsetY, 10, 10);
  
  // Shadow dither
  ctx.fillStyle = adjustBrightness(color, -30);
  ctx.fillRect(3, 12 + offsetY, 10, 2);
  ctx.fillRect(11, 4 + offsetY, 2, 10);
  
  // Highlight (head)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(5, 5 + offsetY, 4, 4);
  
  // Eyes (animated blink)
  ctx.fillStyle = frame === 2 ? '#ffffff' : '#000000'; // Blink on frame 2
  ctx.fillRect(5, 7 + offsetY, 2, 2);
  ctx.fillRect(9, 7 + offsetY, 2, 2);
  
  // Feet movement
  if (frame > 0) {
    const footOffset = Math.sin(frame * Math.PI / 2) * 2;
    ctx.fillStyle = adjustBrightness(color, -40);
    ctx.fillRect(4, 12 + offsetY + footOffset, 3, 2);
    ctx.fillRect(9, 12 + offsetY - footOffset, 3, 2);
  }
  
  return canvas;
}

// Generate chair sprite
export function generateChair(variant = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  
  // Seat
  ctx.fillStyle = PALETTE.chair;
  ctx.fillRect(3, 6, 10, 4);
  
  // Back
  ctx.fillStyle = PALETTE.chairDark;
  ctx.fillRect(3, 2, 10, 4);
  
  // Legs
  ctx.fillStyle = '#171717';
  ctx.fillRect(4, 10, 2, 6);
  ctx.fillRect(10, 10, 2, 6);
  
  // Highlight
  ctx.fillStyle = adjustBrightness(PALETTE.chair, 20);
  ctx.fillRect(3, 2, 10, 1);
  ctx.fillRect(3, 6, 1, 4);
  
  return canvas;
}

// Generate monitor sprite
export function generateMonitor(variant = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  
  // Frame
  ctx.fillStyle = PALETTE.monitorFrame;
  ctx.fillRect(2, 3, 12, 9);
  
  // Screen
  ctx.fillStyle = PALETTE.monitor;
  ctx.fillRect(3, 4, 10, 7);
  
  // Screen glow
  ctx.fillStyle = PALETTE.monitorGlow;
  ctx.fillRect(3, 4, 10, 2);
  
  // Stand
  ctx.fillStyle = '#171717';
  ctx.fillRect(6, 12, 4, 2);
  ctx.fillRect(4, 14, 8, 2);
  
  return canvas;
}

// Generate plant sprite
export function generatePlant(seed = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  
  // Leaves (random variation based on seed)
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + seededRandom(seed + i) * 0.5;
    const len = 4 + seededRandom(seed + i + 10) * 3;
    const lx = 8 + Math.cos(angle) * len * 0.5;
    const ly = 6 + Math.sin(angle) * len * 0.5;
    
    ctx.fillStyle = i < 2 ? PALETTE.plant : PALETTE.plantDark;
    ctx.beginPath();
    ctx.ellipse(lx, ly, 3, 5, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Pot
  ctx.fillStyle = PALETTE.plantPot;
  ctx.fillRect(5, 10, 6, 6);
  ctx.fillStyle = adjustBrightness(PALETTE.plantPot, 20);
  ctx.fillRect(5, 10, 6, 1);
  
  return canvas;
}

// Generate cafeteria table sprite
export function generateTable(color = '#065f46') {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  
  // Table top
  ctx.fillStyle = color;
  ctx.fillRect(1, 8, 14, 3);
  
  // Table edge highlight
  ctx.fillStyle = adjustBrightness(color, 30);
  ctx.fillRect(1, 8, 14, 1);
  
  // Legs
  ctx.fillStyle = '#171717';
  ctx.fillRect(3, 11, 2, 5);
  ctx.fillRect(11, 11, 2, 5);
  
  // Tablecloth pattern
  ctx.fillStyle = adjustBrightness(color, -20);
  for (let x = 2; x < 14; x += 3) {
    ctx.fillRect(x, 9, 1, 1);
  }
  
  return canvas;
}

// Generate floor tile (checker pattern)
export function generateFloorTile(zoneType = 'OFFICE') {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  
  // Zone-specific colors
  const zoneColors = {
    OFFICE: ['#1e293b', '#0f172a'],
    FOCUS_ROOM: ['#1e1e2e', '#0f0f1a'],
    CAFETERIA: ['#1e293b', '#0f172a'],
    ARCADE: ['#1e1e2e', '#0f0f1a'],
    STUDIO: ['#1a1a2e', '#0a0a1a'],
  };
  
  const [c1, c2] = zoneColors[zoneType] || zoneColors.OFFICE;
  
  // Checker pattern
  ctx.fillStyle = c1;
  ctx.fillRect(0, 0, 16, 16);
  
  ctx.fillStyle = c2;
  for (let y = 0; y < 16; y += 2) {
    for (let x = 0; x < 16; x += 2) {
      ctx.fillRect(x, y, 1, 1);
      ctx.fillRect(x + 1, y + 1, 1, 1);
    }
  }
  
  return canvas;
}

// Generate wall tile
export function generateWallTile() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  
  // Base
  ctx.fillStyle = PALETTE.wall;
  ctx.fillRect(0, 0, 16, 16);
  
  // Brick pattern
  ctx.fillStyle = adjustBrightness(PALETTE.wall, -15);
  ctx.fillRect(0, 7, 16, 1);
  ctx.fillRect(7, 0, 1, 7);
  ctx.fillRect(0, 14, 16, 1);
  
  // Highlight top
  ctx.fillStyle = PALETTE.wallHighlight;
  ctx.fillRect(0, 0, 16, 1);
  ctx.fillRect(0, 0, 1, 16);
  
  // Shadow
  ctx.fillStyle = adjustBrightness(PALETTE.wall, -30);
  ctx.fillRect(0, 15, 16, 1);
  ctx.fillRect(15, 0, 1, 16);
  
  return canvas;
}

// Generate arcade machine sprite
export function generateArcadeMachine(seed = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  
  // Body
  ctx.fillStyle = '#7c3aed';
  ctx.fillRect(3, 5, 10, 11);
  
  // Screen
  const screenColors = ['#ec4899', '#3b82f6', '#22c55e', '#f59e0b'];
  ctx.fillStyle = screenColors[Math.floor(seededRandom(seed) * screenColors.length)];
  ctx.fillRect(4, 6, 8, 5);
  
  // Screen glow (scanlines)
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.3;
  for (let y = 0; y < 5; y += 2) {
    ctx.fillRect(4, 6 + y, 8, 1);
  }
  ctx.globalAlpha = 1.0;
  
  // Control panel
  ctx.fillStyle = '#171717';
  ctx.fillRect(4, 12, 8, 2);
  
  // Highlight
  ctx.fillStyle = '#a78bfa';
  ctx.fillRect(3, 5, 10, 1);
  ctx.fillRect(3, 5, 1, 11);
  
  return canvas;
}

// Helper: adjust color brightness
function adjustBrightness(hex, amount) {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Cache for generated sprites
const spriteCache = new Map();

export function getCachedSprite(generator, key, seed = 0) {
  const cacheKey = `${key}_${seed}`;
  if (!spriteCache.has(cacheKey)) {
    spriteCache.set(cacheKey, generator(seed));
  }
  return spriteCache.get(cacheKey);
}