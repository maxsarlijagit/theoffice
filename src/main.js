import Phaser from 'phaser';
import officeLayout from '../maps/map1.json';

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;
const PLAYER_SPEED = 180;
const PLAYER_COLLIDER_RADIUS = 9;
const WALL_HEIGHT = 54;

const AREA_FALLBACK = '#2b3440';

const layout = officeLayout;
const areaStyles = layout.areaStyles;
const tilesByKey = new Map(layout.tiles.map((tile) => [`${tile.x},${tile.y}`, tile]));
const furnitureBlockerKeys = new Set();

function gridToIso(x, y) {
  return {
    x: (x - y) * (TILE_WIDTH / 2),
    y: (x + y) * (TILE_HEIGHT / 2),
  };
}

function isoToGrid(x, y) {
  return {
    x: Math.floor((y / (TILE_HEIGHT / 2) + x / (TILE_WIDTH / 2)) / 2),
    y: Math.floor((y / (TILE_HEIGHT / 2) - x / (TILE_WIDTH / 2)) / 2),
  };
}

function colorToNumber(color) {
  return Number.parseInt(color.replace('#', ''), 16);
}

function darkenColor(color, amount = 0.72) {
  const value = colorToNumber(color);
  const r = Math.floor(((value >> 16) & 255) * amount);
  const g = Math.floor(((value >> 8) & 255) * amount);
  const b = Math.floor((value & 255) * amount);
  return (r << 16) + (g << 8) + b;
}

function findSpawnTile() {
  return layout.tiles.find((tile) => tile.area === 'Spawn')
    || layout.tiles[Math.floor(layout.tiles.length / 2)]
    || { x: 0, y: 0, area: 'Unknown' };
}

function isWalkableTile(x, y) {
  return tilesByKey.has(`${x},${y}`);
}

function getTileKey(x, y) {
  return `${x},${y}`;
}

function getTileEdgePointsByEdge(tile, edge) {
  const iso = gridToIso(tile.x, tile.y);
  const north = { x: iso.x, y: iso.y - TILE_HEIGHT / 2 };
  const east = { x: iso.x + TILE_WIDTH / 2, y: iso.y };
  const south = { x: iso.x, y: iso.y + TILE_HEIGHT / 2 };
  const west = { x: iso.x - TILE_WIDTH / 2, y: iso.y };

  if (edge === 'top') return [north, east];
  if (edge === 'right') return [east, south];
  if (edge === 'bottom') return [south, west];
  return [west, north];
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const projection = {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };
  return Math.hypot(point.x - projection.x, point.y - projection.y);
}

function createWallSegments() {
  if (!Array.isArray(layout.walls)) return [];

  return layout.walls.map((wall, index) => {
    const [start, end] = getTileEdgePointsByEdge(wall, wall.edge);

    return {
      start,
      end,
      key: `wall:${wall.x},${wall.y}:${wall.edge}:${index}`,
      height: wall.height || WALL_HEIGHT,
      depth: Math.max(start.y, end.y),
    };
  });
}

const wallSegments = createWallSegments();
const floorSpritePaths = [...new Set(layout.tiles.map((tile) => tile.floorSprite).filter(Boolean))];

const fallbackFurnitureItems = [
  { x: 13, y: 13, width: 2, depth: 2, height: 48, color: '#486176' },
  { x: 18, y: 11, width: 2, depth: 2, height: 42, color: '#6f5b8f' },
  { x: 5, y: 5, width: 2, depth: 2, height: 44, color: '#7359a6' },
  { x: 5, y: 18, width: 2, depth: 2, height: 44, color: '#2e7d92' },
  { x: 15, y: 28, width: 2, depth: 2, height: 46, color: '#4f3c75' },
  { x: 28, y: 12, width: 2, depth: 2, height: 46, color: '#9c4444' },
  { x: 26, y: 26, width: 2, depth: 2, height: 46, color: '#287f55' },
];

const furnitureItems = Array.isArray(layout.objects) && layout.objects.length > 0
  ? layout.objects.map((object) => ({
    x: object.x,
    y: object.y,
    width: object.width || 1,
    depth: object.depth || 1,
    height: object.height || 40,
    color: '#486176',
    sprite: object.sprite,
    name: object.name || 'Object',
    collider: object.collider !== false,
  }))
  : fallbackFurnitureItems;

for (const item of furnitureItems) {
  if (item.collider === false) continue;

  for (let x = item.x; x < item.x + item.width; x += 1) {
    for (let y = item.y; y < item.y + item.depth; y += 1) {
      furnitureBlockerKeys.add(getTileKey(x, y));
    }
  }
}

function getAreaAtWorldPoint(x, y) {
  const gridPoint = isoToGrid(x, y);
  const tile = tilesByKey.get(`${gridPoint.x},${gridPoint.y}`);
  return tile?.area || 'Outside';
}

class OfficeScene extends Phaser.Scene {
  constructor() {
    super('OfficeScene');
    this.player = null;
    this.cursors = null;
    this.wasd = null;
    this.zoneName = null;
    this.spawnPoint = findSpawnTile();
  }

  preload() {
    this.textures.getTextureKeys().forEach((key) => {
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    });

    const spritePaths = [...new Set([
      ...floorSpritePaths,
      ...furnitureItems.map((item) => item.sprite).filter(Boolean),
    ])];

    for (const spritePath of spritePaths) {
      this.load.image(spritePath, spritePath);
    }
  }

  create() {
    this.cameras.main.setBackgroundColor('#0d1117');
    this.textures.getTextureKeys().forEach((key) => {
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    });

    this.mapLayer = this.add.container(0, 0);
    this.drawIsoMap();
    this.wallColliders = wallSegments;
    this.drawWalls();
    this.drawFurniture();
    this.createPlayer();
    this.createCamera();
    this.createInput();
    this.bindJoinButton();
    this.updateZoneDisplay();
  }

  update(_, delta) {
    if (!this.player || !this.cursors) return;

    const seconds = delta / 1000;
    const dx = this.getHorizontalInput();
    const dy = this.getVerticalInput();

    if (dx === 0 && dy === 0) {
      this.player.setData('moving', false);
      return;
    }

    const length = Math.hypot(dx, dy) || 1;
    const nextX = this.player.x + (dx / length) * PLAYER_SPEED * seconds;
    const nextY = this.player.y + (dy / length) * PLAYER_SPEED * seconds;

    if (this.canMoveTo(nextX, this.player.y)) this.player.x = nextX;
    if (this.canMoveTo(this.player.x, nextY)) this.player.y = nextY;

    this.player.setDepth(this.player.y + 14);
    this.player.setData('moving', true);
    this.updateZoneDisplay();
  }

  drawIsoMap() {
    const graphics = this.add.graphics();

    for (const tile of layout.tiles) {
      const iso = gridToIso(tile.x, tile.y);
      const hasFloorSprite = tile.floorSprite && this.textures.exists(tile.floorSprite);

      if (hasFloorSprite) {
        const image = this.add.image(iso.x, iso.y, tile.floorSprite);
        image.setOrigin(0.5, 0.5);
        image.setDisplaySize(TILE_WIDTH, TILE_HEIGHT);
        image.setDepth(iso.y - 1000);
        continue;
      }

      const baseColor = areaStyles[tile.area]?.color || AREA_FALLBACK;
      const fillColor = colorToNumber(baseColor);

      graphics.fillStyle(fillColor, tile.area === 'Spawn' ? 0.9 : 0.72);
      graphics.lineStyle(1, 0x0d1117, 0.55);
      this.drawDiamond(graphics, iso.x, iso.y, TILE_WIDTH, TILE_HEIGHT);
    }

    this.mapLayer.add(graphics);
    this.mapLayer.setDepth(-1000);
  }

  drawWalls() {
    for (const segment of wallSegments) {
      const graphics = this.add.graphics();
      this.drawWallSegment(graphics, segment);
      graphics.setDepth(segment.depth + 0.1);
    }
  }

  drawWallSegment(graphics, segment) {
    const { start, end } = segment;
    const wallHeight = segment.height || WALL_HEIGHT;
    const topStart = { x: start.x, y: start.y - wallHeight };
    const topEnd = { x: end.x, y: end.y - wallHeight };

    graphics.fillStyle(0x334155, 1);
    graphics.lineStyle(1, 0x0f172a, 1);
    graphics.fillPoints([start, end, topEnd, topStart], true);
    graphics.strokePoints([start, end, topEnd, topStart], true);
  }

  drawFurniture() {
    for (const item of furnitureItems) {
      if (item.sprite && this.textures.exists(item.sprite)) {
        const anchor = gridToIso(item.x + item.width / 2 - 0.5, item.y + item.depth / 2 - 0.5);
        const image = this.add.image(anchor.x, anchor.y, item.sprite);
        const source = this.textures.get(item.sprite).getSourceImage();
        const displayWidth = TILE_WIDTH * item.width;
        const aspectRatio = source.width > 0 ? source.height / source.width : 1;

        image.setOrigin(0.5, 1);
        image.setDisplaySize(displayWidth, displayWidth * aspectRatio);
        image.setDepth(anchor.y + TILE_HEIGHT / 2);
        continue;
      }

      const graphics = this.add.graphics();
      this.drawIsoBox(graphics, item);
      const corners = this.getFurnitureFootprint(item);
      graphics.setDepth(Math.max(...corners.map((point) => point.y)));
    }
  }

  getFurnitureFootprint(item) {
    return [
      gridToIso(item.x - 0.5, item.y - 0.5),
      gridToIso(item.x + item.width - 0.5, item.y - 0.5),
      gridToIso(item.x + item.width - 0.5, item.y + item.depth - 0.5),
      gridToIso(item.x - 0.5, item.y + item.depth - 0.5),
    ];
  }

  drawIsoBox(graphics, item) {
    const footprint = this.getFurnitureFootprint(item);
    const top = footprint.map((point) => ({ x: point.x, y: point.y - item.height }));
    const baseColor = colorToNumber(item.color);

    graphics.fillStyle(0x000000, 0.22);
    graphics.fillPoints(footprint.map((point) => ({ x: point.x, y: point.y + 3 })), true);

    graphics.lineStyle(1, 0x0d1117, 0.7);
    graphics.fillStyle(darkenColor(item.color, 0.6), 1);
    graphics.fillPoints([footprint[2], footprint[3], top[3], top[2]], true);
    graphics.strokePoints([footprint[2], footprint[3], top[3], top[2]], true);

    graphics.fillStyle(darkenColor(item.color, 0.78), 1);
    graphics.fillPoints([footprint[1], footprint[2], top[2], top[1]], true);
    graphics.strokePoints([footprint[1], footprint[2], top[2], top[1]], true);

    graphics.fillStyle(baseColor, 1);
    graphics.fillPoints(top, true);
    graphics.strokePoints(top, true);
  }

  drawDiamond(graphics, x, y, width, height) {
    graphics.beginPath();
    graphics.moveTo(x, y - height / 2);
    graphics.lineTo(x + width / 2, y);
    graphics.lineTo(x, y + height / 2);
    graphics.lineTo(x - width / 2, y);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
  }

  createPlayer() {
    const spawnIso = gridToIso(this.spawnPoint.x, this.spawnPoint.y);
    const player = this.add.container(spawnIso.x, spawnIso.y - 12);

    const shadow = this.add.ellipse(0, 13, 26, 10, 0x000000, 0.35);
    const body = this.add.rectangle(0, 0, 20, 28, 0x3b82f6);
    const head = this.add.circle(0, -19, 9, 0xe6edf3);
    const visor = this.add.rectangle(4, -20, 8, 3, 0x0d1117);

    body.setStrokeStyle(2, 0x10233f, 1);
    head.setStrokeStyle(2, 0x9fb7d9, 1);

    player.add([shadow, body, head, visor]);
    player.setDepth(player.y + 14);
    player.setSize(24, 42);
    player.setData('moving', false);
    this.player = player;
  }

  createCamera() {
    const bounds = this.getMapBounds();
    this.cameras.main.setBounds(
      bounds.left - 300,
      bounds.top - 260,
      bounds.width + 600,
      bounds.height + 520,
    );
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setZoom(1.2);
  }

  getMapBounds() {
    const points = layout.tiles.map((tile) => gridToIso(tile.x, tile.y));
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const left = Math.min(...xs) - TILE_WIDTH;
    const right = Math.max(...xs) + TILE_WIDTH;
    const top = Math.min(...ys) - TILE_HEIGHT;
    const bottom = Math.max(...ys) + TILE_HEIGHT;

    return {
      left,
      top,
      width: right - left,
      height: bottom - top,
    };
  }

  createInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
  }

  bindJoinButton() {
    const joinBtn = document.getElementById('join-btn');
    if (!joinBtn) return;

    joinBtn.onclick = () => {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('game-ui').style.display = 'block';
      this.cameras.main.centerOn(this.player.x, this.player.y);
    };
  }

  getHorizontalInput() {
    const left = this.cursors.left.isDown || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;
    return Number(right) - Number(left);
  }

  getVerticalInput() {
    const up = this.cursors.up.isDown || this.wasd.up.isDown;
    const down = this.cursors.down.isDown || this.wasd.down.isDown;
    return Number(down) - Number(up);
  }

  canMoveTo(worldX, worldY) {
    const footWorld = { x: worldX, y: worldY + 14 };
    const footPoint = isoToGrid(footWorld.x, footWorld.y);
    if (!isWalkableTile(footPoint.x, footPoint.y)) return false;
    if (furnitureBlockerKeys.has(getTileKey(footPoint.x, footPoint.y))) return false;

    return !this.wallColliders.some((segment) => {
      return distanceToSegment(footWorld, segment.start, segment.end) < PLAYER_COLLIDER_RADIUS;
    });
  }

  updateZoneDisplay() {
    const zone = getAreaAtWorldPoint(this.player.x, this.player.y + 14);
    if (zone === this.zoneName) return;

    this.zoneName = zone;
    const color = areaStyles[zone]?.color || '#3b82f6';
    const zoneName = document.getElementById('zone-name');
    const zoneIndicator = document.getElementById('zone-indicator');

    if (zoneName) {
      zoneName.textContent = zone;
      zoneName.style.color = color;
    }

    if (zoneIndicator) zoneIndicator.style.background = color;
  }
}

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#0d1117',
  pixelArt: true,
  roundPixels: true,
  render: {
    pixelArt: true,
    antialias: false,
    antialiasGL: false,
    roundPixels: true,
  },
  scene: OfficeScene,
};

const game = new Phaser.Game(config);

window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});
