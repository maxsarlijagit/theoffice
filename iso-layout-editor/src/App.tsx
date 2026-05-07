import {
  type ChangeEvent,
  type MouseEvent,
  type WheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import './App.css'

const DEFAULT_GRID_WIDTH = 40
const DEFAULT_GRID_HEIGHT = 40
const DEFAULT_CELL_SIZE = 32
const CANVAS_PADDING = 1
const MIN_GRID_SIZE = 1
const MAX_GRID_SIZE = 200
const MIN_CELL_SIZE = 12
const MAX_CELL_SIZE = 96
const MIN_ZOOM = 0.2
const MAX_ZOOM = 4
const FIT_PADDING = 48
const DEFAULT_GENERATOR_SEED = 1
const DEFAULT_ROOM_COUNT = 8
const DEFAULT_MIN_ROOM_SIZE = 4
const DEFAULT_MAX_ROOM_SIZE = 8

const WALL_EDGES = ['top', 'right', 'bottom', 'left'] as const
const DEFAULT_AREA_NAME = 'Floor'
const DEFAULT_AREA_COLOR = '#60a5fa'

type WallEdge = (typeof WALL_EDGES)[number]
type ToolMode = 'wall' | 'floor' | 'fill'
type PaintOperation = 'add' | 'subtract'
type CanvasTheme = 'light' | 'dark'

type Tile = {
  x: number
  y: number
  type: 'floor'
  area: string
  color: string
}

type Wall = {
  x: number
  y: number
  edge: WallEdge
}

type GridConfig = {
  width: number
  height: number
  cellSize: number
}

type Point = {
  x: number
  y: number
}

type ViewState = {
  x: number
  y: number
  zoom: number
}

type HistoryEntry = {
  tiles: Tile[]
  walls: Wall[]
}

type ExportedAreaStyle = {
  color: string
}

type ExportedArea = {
  id: string
  name: string
  cells: Array<{ x: number; y: number }>
  bounds: { x: number; y: number; width: number; height: number }
}

type GeneratorConfig = {
  seed: number
  roomCount: number
  minRoomSize: number
  maxRoomSize: number
  corridors: boolean
  shape: 'free' | 'diamond'
}

type GeneratedRoom = {
  x: number
  y: number
  width: number
  height: number
}

const DIRECTIONS: Array<{
  dx: number
  dy: number
  edge: WallEdge
  oppositeEdge: WallEdge
}> = [
  { dx: 0, dy: -1, edge: 'top', oppositeEdge: 'bottom' },
  { dx: 1, dy: 0, edge: 'right', oppositeEdge: 'left' },
  { dx: 0, dy: 1, edge: 'bottom', oppositeEdge: 'top' },
  { dx: -1, dy: 0, edge: 'left', oppositeEdge: 'right' },
]

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function randomInt(random: () => number, min: number, max: number) {
  return Math.floor(random() * (max - min + 1)) + min
}

function getAreaKey(area: string, color: string) {
  return `${area}::${color}`
}

function getCellKey(x: number, y: number) {
  return `${x},${y}`
}

function getWallNeighbor(x: number, y: number, edge: WallEdge): Point {
  switch (edge) {
    case 'top':
      return { x, y: y - 1 }
    case 'right':
      return { x: x + 1, y }
    case 'bottom':
      return { x, y: y + 1 }
    case 'left':
      return { x: x - 1, y }
  }
}

function getCanonicalWall(wall: Wall, grid: GridConfig): Wall {
  if (wall.edge === 'bottom' && wall.y + 1 < grid.height) {
    return { x: wall.x, y: wall.y + 1, edge: 'top' }
  }

  if (wall.edge === 'right' && wall.x + 1 < grid.width) {
    return { x: wall.x + 1, y: wall.y, edge: 'left' }
  }

  return wall
}

function getCanonicalWallKey(wall: Wall, grid: GridConfig) {
  const canonicalWall = getCanonicalWall(wall, grid)

  return `${canonicalWall.x},${canonicalWall.y},${canonicalWall.edge}`
}

function getConnectionKey(a: Point, b: Point) {
  const aKey = getCellKey(a.x, a.y)
  const bKey = getCellKey(b.x, b.y)

  return aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`
}

function getTileFillKey(tile: Tile | undefined) {
  return tile ? getAreaKey(tile.area, tile.color) : 'empty'
}

function getExportedAreas(tiles: Tile[]): ExportedArea[] {
  const tilesByArea = new Map<string, Map<string, Tile>>()

  for (const tile of tiles) {
    const areaTiles = tilesByArea.get(tile.area) ?? new Map<string, Tile>()
    areaTiles.set(getCellKey(tile.x, tile.y), tile)
    tilesByArea.set(tile.area, areaTiles)
  }

  const areas: ExportedArea[] = []

  for (const [areaName, areaTiles] of [...tilesByArea.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const visitedCells = new Set<string>()
    let regionIndex = 1

    for (const startTile of [...areaTiles.values()].sort(
      (a, b) => a.y - b.y || a.x - b.x,
    )) {
      const startKey = getCellKey(startTile.x, startTile.y)

      if (visitedCells.has(startKey)) {
        continue
      }

      const cells: Array<{ x: number; y: number }> = []
      const queue: Point[] = [{ x: startTile.x, y: startTile.y }]

      while (queue.length > 0) {
        const cell = queue.shift()

        if (!cell) {
          continue
        }

        const key = getCellKey(cell.x, cell.y)

        if (visitedCells.has(key) || !areaTiles.has(key)) {
          continue
        }

        visitedCells.add(key)
        cells.push({ x: cell.x, y: cell.y })

        for (const direction of DIRECTIONS) {
          queue.push({ x: cell.x + direction.dx, y: cell.y + direction.dy })
        }
      }

      cells.sort((a, b) => a.y - b.y || a.x - b.x)

      const minX = Math.min(...cells.map((cell) => cell.x))
      const minY = Math.min(...cells.map((cell) => cell.y))
      const maxX = Math.max(...cells.map((cell) => cell.x))
      const maxY = Math.max(...cells.map((cell) => cell.y))

      areas.push({
        id: `${areaName}-${regionIndex}`,
        name: areaName,
        cells,
        bounds: {
          x: minX,
          y: minY,
          width: maxX - minX + 1,
          height: maxY - minY + 1,
        },
      })
      regionIndex += 1
    }
  }

  return areas
}

function getRoomCenter(room: GeneratedRoom): Point {
  return {
    x: Math.floor(room.x + room.width / 2),
    y: Math.floor(room.y + room.height / 2),
  }
}

function roomsOverlap(a: GeneratedRoom, b: GeneratedRoom) {
  return (
    a.x < b.x + b.width + 1 &&
    a.x + a.width + 1 > b.x &&
    a.y < b.y + b.height + 1 &&
    a.y + a.height + 1 > b.y
  )
}

function roomsTouchOrOverlap(a: GeneratedRoom, b: GeneratedRoom) {
  return roomsOverlap(a, b)
}

function roomsActuallyOverlap(a: GeneratedRoom, b: GeneratedRoom) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

function getAttachedRoomCandidate(
  random: () => number,
  room: GeneratedRoom,
  width: number,
  height: number,
  grid: GridConfig,
): GeneratedRoom {
  const side = randomInt(random, 0, 3)

  switch (side) {
    case 0:
      return {
        x: clamp(randomInt(random, room.x - width + 1, room.x + room.width - 1), 0, grid.width - width),
        y: room.y - height,
        width,
        height,
      }
    case 1:
      return {
        x: room.x + room.width,
        y: clamp(randomInt(random, room.y - height + 1, room.y + room.height - 1), 0, grid.height - height),
        width,
        height,
      }
    case 2:
      return {
        x: clamp(randomInt(random, room.x - width + 1, room.x + room.width - 1), 0, grid.width - width),
        y: room.y + room.height,
        width,
        height,
      }
    default:
      return {
        x: room.x - width,
        y: clamp(randomInt(random, room.y - height + 1, room.y + room.height - 1), 0, grid.height - height),
        width,
        height,
      }
  }
}

function getGeneratedColor(index: number) {
  const hue = (index * 47) % 360
  const saturation = 0.72
  const lightness = 0.58
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = lightness - chroma / 2
  const [r, g, b] =
    hue < 60
      ? [chroma, x, 0]
      : hue < 120
        ? [x, chroma, 0]
        : hue < 180
          ? [0, chroma, x]
          : hue < 240
            ? [0, x, chroma]
            : hue < 300
              ? [x, 0, chroma]
              : [chroma, 0, x]

  return `#${[r, g, b]
    .map((channel) =>
      Math.round((channel + m) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

function getDiamondRoomSlots(count: number) {
  const slots: Point[] = [{ x: 0, y: 0 }]
  let radius = 1

  while (slots.length < count) {
    for (let y = -radius; y <= radius; y += 1) {
      for (let x = -radius; x <= radius; x += 1) {
        if (Math.abs(x) + Math.abs(y) === radius) {
          slots.push({ x, y })
        }
      }
    }

    radius += 1
  }

  return slots.slice(0, count)
}

function getCenteredLayout(
  layout: { tiles: Tile[]; walls: Wall[] },
  grid: GridConfig,
) {
  if (layout.tiles.length === 0) {
    return layout
  }

  const minX = Math.min(...layout.tiles.map((tile) => tile.x))
  const minY = Math.min(...layout.tiles.map((tile) => tile.y))
  const maxX = Math.max(...layout.tiles.map((tile) => tile.x))
  const maxY = Math.max(...layout.tiles.map((tile) => tile.y))
  const offsetX = Math.round((grid.width - (maxX - minX + 1)) / 2 - minX)
  const offsetY = Math.round((grid.height - (maxY - minY + 1)) / 2 - minY)

  return {
    tiles: layout.tiles.map((tile) => ({
      ...tile,
      x: tile.x + offsetX,
      y: tile.y + offsetY,
    })),
    walls: layout.walls.map((wall) => ({
      ...wall,
      x: wall.x + offsetX,
      y: wall.y + offsetY,
    })),
  }
}

function generateLayout(
  grid: GridConfig,
  config: GeneratorConfig,
): { tiles: Tile[]; walls: Wall[] } {
  const random = createSeededRandom(config.seed)
  const minRoomSize = clamp(
    Math.min(config.minRoomSize, config.maxRoomSize),
    1,
    Math.max(1, Math.min(grid.width, grid.height)),
  )
  const maxRoomSize = clamp(
    Math.max(config.minRoomSize, config.maxRoomSize),
    minRoomSize,
    Math.max(1, Math.min(grid.width, grid.height)),
  )
  const rooms: GeneratedRoom[] = []
  const maxAttempts = Math.max(100, config.roomCount * 60)
  const diamondSlots = getDiamondRoomSlots(config.roomCount)
  const diamondSpacing = maxRoomSize + 1
  const diamondCenter = {
    x: Math.floor(grid.width / 2),
    y: Math.floor(grid.height / 2),
  }

  for (let attempt = 0; attempt < maxAttempts && rooms.length < config.roomCount; attempt += 1) {
    const width = randomInt(random, minRoomSize, Math.min(maxRoomSize, grid.width))
    const height = randomInt(random, minRoomSize, Math.min(maxRoomSize, grid.height))
    const slot = diamondSlots[rooms.length]
    const room =
      config.shape === 'diamond' && slot
        ? {
            x: diamondCenter.x + slot.x * diamondSpacing - Math.floor(width / 2),
            y: diamondCenter.y + slot.y * diamondSpacing - Math.floor(height / 2),
            width,
            height,
          }
        : !config.corridors && rooms.length > 0
          ? getAttachedRoomCandidate(
              random,
              rooms[randomInt(random, 0, rooms.length - 1)],
              width,
              height,
              grid,
            )
          : {
              x: randomInt(random, 0, Math.max(0, grid.width - width)),
              y: randomInt(random, 0, Math.max(0, grid.height - height)),
              width,
              height,
            }

    if (
      room.x >= 0 &&
      room.y >= 0 &&
      room.x + room.width <= grid.width &&
      room.y + room.height <= grid.height &&
      !rooms.some((existingRoom) =>
        config.corridors
          ? roomsTouchOrOverlap(room, existingRoom)
          : roomsActuallyOverlap(room, existingRoom),
      )
    ) {
      rooms.push(room)
    }
  }

  const generatedTiles = new Map<string, Tile>()

  rooms.forEach((room, index) => {
    const area = `Room-${index + 1}`
    const color = getGeneratedColor(index)

    for (let y = room.y; y < room.y + room.height; y += 1) {
      for (let x = room.x; x < room.x + room.width; x += 1) {
        generatedTiles.set(getCellKey(x, y), {
          x,
          y,
          type: 'floor',
          area,
          color,
        })
      }
    }
  })

  const carveCorridorCell = (x: number, y: number) => {
    const key = getCellKey(x, y)

    if (generatedTiles.has(key)) {
      return
    }

    generatedTiles.set(getCellKey(x, y), {
      x,
      y,
      type: 'floor',
      area: 'Corridor',
      color: '#94a3b8',
    })
  }

  if (config.shape === 'diamond' && rooms.length > 0) {
    const diamondRadius =
      Math.max(
        ...rooms.flatMap((room) => [
          Math.abs(room.x - diamondCenter.x) + Math.abs(room.y - diamondCenter.y),
          Math.abs(room.x + room.width - 1 - diamondCenter.x) +
            Math.abs(room.y - diamondCenter.y),
          Math.abs(room.x - diamondCenter.x) +
            Math.abs(room.y + room.height - 1 - diamondCenter.y),
          Math.abs(room.x + room.width - 1 - diamondCenter.x) +
            Math.abs(room.y + room.height - 1 - diamondCenter.y),
        ]),
      ) + 1

    for (let y = 0; y < grid.height; y += 1) {
      for (let x = 0; x < grid.width; x += 1) {
        if (
          Math.abs(x - diamondCenter.x) + Math.abs(y - diamondCenter.y) <=
          diamondRadius
        ) {
          carveCorridorCell(x, y)
        }
      }
    }
  }

  if (config.corridors) {
    for (let index = 1; index < rooms.length; index += 1) {
      const from = getRoomCenter(rooms[index - 1])
      const to = getRoomCenter(rooms[index])
      let x = from.x
      let y = from.y
      const horizontalFirst = random() >= 0.5

      if (horizontalFirst) {
        while (x !== to.x) {
          carveCorridorCell(x, y)
          x += x < to.x ? 1 : -1
        }

        while (y !== to.y) {
          carveCorridorCell(x, y)
          y += y < to.y ? 1 : -1
        }
      } else {
        while (y !== to.y) {
          carveCorridorCell(x, y)
          y += y < to.y ? 1 : -1
        }

        while (x !== to.x) {
          carveCorridorCell(x, y)
          x += x < to.x ? 1 : -1
        }
      }

      carveCorridorCell(to.x, to.y)
    }
  }

  const generatedWalls = new Map<string, Wall>()

  for (const tile of generatedTiles.values()) {
    for (const direction of DIRECTIONS) {
      const neighbor = { x: tile.x + direction.dx, y: tile.y + direction.dy }
      const neighborIsFloor = generatedTiles.has(getCellKey(neighbor.x, neighbor.y))

      if (!neighborIsFloor) {
        const wall = getCanonicalWall(
          { x: tile.x, y: tile.y, edge: direction.edge },
          grid,
        )
        generatedWalls.set(getCanonicalWallKey(wall, grid), wall)
      }
    }
  }

  return getCenteredLayout({
    tiles: [...generatedTiles.values()],
    walls: [...generatedWalls.values()],
  }, grid)
}

function isWallEdge(value: unknown): value is WallEdge {
  return typeof value === 'string' && WALL_EDGES.includes(value as WallEdge)
}

function getIsoMetrics(grid: GridConfig) {
  const tileWidth = grid.cellSize
  const tileHeight = grid.cellSize / 2

  return {
    tileWidth,
    tileHeight,
    originX: grid.height * (tileWidth / 2) + CANVAS_PADDING,
    originY: CANVAS_PADDING,
    width: (grid.width + grid.height) * (tileWidth / 2) + CANVAS_PADDING * 2,
    height: (grid.width + grid.height) * (tileHeight / 2) + CANVAS_PADDING * 2,
  }
}

function getTileTopPoint(x: number, y: number, grid: GridConfig): Point {
  const { tileWidth, tileHeight, originX, originY } = getIsoMetrics(grid)

  return {
    x: originX + (x - y) * (tileWidth / 2),
    y: originY + (x + y) * (tileHeight / 2),
  }
}

function traceTilePath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  grid: GridConfig,
) {
  const { tileWidth, tileHeight } = getIsoMetrics(grid)
  const top = getTileTopPoint(x, y, grid)

  context.beginPath()
  context.moveTo(top.x, top.y)
  context.lineTo(top.x + tileWidth / 2, top.y + tileHeight / 2)
  context.lineTo(top.x, top.y + tileHeight)
  context.lineTo(top.x - tileWidth / 2, top.y + tileHeight / 2)
  context.closePath()
}

function getCanvasPointFromMouseEvent(event: MouseEvent<HTMLCanvasElement>): Point {
  const rect = event.currentTarget.getBoundingClientRect()

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

function screenToWorld(point: Point, view: ViewState): Point {
  return {
    x: (point.x - view.x) / view.zoom,
    y: (point.y - view.y) / view.zoom,
  }
}

function getCellFromWorldPoint(point: Point, grid: GridConfig): Point | null {
  const { tileWidth, tileHeight, originX, originY } = getIsoMetrics(grid)
  const projectedX = (point.x - originX) / (tileWidth / 2)
  const projectedY = (point.y - originY) / (tileHeight / 2)
  const x = Math.floor((projectedY + projectedX) / 2)
  const y = Math.floor((projectedY - projectedX) / 2)

  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) {
    return null
  }

  return { x, y }
}

function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy

  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y)
  }

  const t = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
    0,
    1,
  )
  const closestX = start.x + t * dx
  const closestY = start.y + t * dy

  return Math.hypot(point.x - closestX, point.y - closestY)
}

function getWallTargetFromWorldPoint(point: Point, grid: GridConfig): Wall | null {
  const cell = getCellFromWorldPoint(point, grid)

  if (!cell) {
    return null
  }

  const { tileWidth, tileHeight } = getIsoMetrics(grid)
  const top = getTileTopPoint(cell.x, cell.y, grid)
  const right = { x: top.x + tileWidth / 2, y: top.y + tileHeight / 2 }
  const bottom = { x: top.x, y: top.y + tileHeight }
  const left = { x: top.x - tileWidth / 2, y: top.y + tileHeight / 2 }
  const edgeDistances: Array<{ edge: WallEdge; distance: number }> = [
    { edge: 'top', distance: distanceToSegment(point, top, right) },
    { edge: 'right', distance: distanceToSegment(point, right, bottom) },
    { edge: 'bottom', distance: distanceToSegment(point, bottom, left) },
    { edge: 'left', distance: distanceToSegment(point, left, top) },
  ]
  const nearestEdge = edgeDistances.reduce((nearest, current) =>
    current.distance < nearest.distance ? current : nearest,
  )

  return { x: cell.x, y: cell.y, edge: nearestEdge.edge }
}

function getFitView(grid: GridConfig, viewport: Point): ViewState {
  const bounds = getIsoMetrics(grid)
  const availableWidth = Math.max(1, viewport.x - FIT_PADDING * 2)
  const availableHeight = Math.max(1, viewport.y - FIT_PADDING * 2)
  const zoom = clamp(
    Math.min(availableWidth / bounds.width, availableHeight / bounds.height),
    MIN_ZOOM,
    MAX_ZOOM,
  )

  return {
    x: (viewport.x - bounds.width * zoom) / 2,
    y: (viewport.y - bounds.height * zoom) / 2,
    zoom,
  }
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isPaintingRef = useRef(false)
  const isPanningRef = useRef(false)
  const isSpacePressedRef = useRef(false)
  const isAltPressedRef = useRef(false)
  const lastPaintedCellRef = useRef<Point | null>(null)
  const lastPaintedWallRef = useRef<Wall | null>(null)
  const lastPanPointRef = useRef<Point | null>(null)
  const tilesRef = useRef<Tile[]>([])
  const wallsRef = useRef<Wall[]>([])
  const historyRef = useRef<HistoryEntry[]>([])
  const [tiles, setTiles] = useState<Tile[]>([])
  const [walls, setWalls] = useState<Wall[]>([])
  const [toolMode, setToolMode] = useState<ToolMode>('floor')
  const [paintOperation, setPaintOperation] = useState<PaintOperation>('add')
  const [areaName, setAreaName] = useState(DEFAULT_AREA_NAME)
  const [areaColor, setAreaColor] = useState(DEFAULT_AREA_COLOR)
  const [canvasTheme, setCanvasTheme] = useState<CanvasTheme>('light')
  const [hiddenAreaKeys, setHiddenAreaKeys] = useState<Set<string>>(
    () => new Set(),
  )
  const [areaDrafts, setAreaDrafts] = useState<
    Record<string, { area: string; color: string }>
  >({})
  const [grid, setGrid] = useState<GridConfig>({
    width: DEFAULT_GRID_WIDTH,
    height: DEFAULT_GRID_HEIGHT,
    cellSize: DEFAULT_CELL_SIZE,
  })
  const [generatorConfig, setGeneratorConfig] = useState<GeneratorConfig>({
    seed: DEFAULT_GENERATOR_SEED,
    roomCount: DEFAULT_ROOM_COUNT,
    minRoomSize: DEFAULT_MIN_ROOM_SIZE,
    maxRoomSize: DEFAULT_MAX_ROOM_SIZE,
    corridors: true,
    shape: 'free',
  })
  const [viewportSize, setViewportSize] = useState<Point>({ x: 1, y: 1 })
  const [view, setView] = useState<ViewState>({ x: 48, y: 48, zoom: 1 })
  const areaGroups = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; area: string; color: string; count: number }
    >()

    for (const tile of tiles) {
      const key = getAreaKey(tile.area, tile.color)
      const group = groups.get(key)

      if (group) {
        group.count += 1
      } else {
        groups.set(key, {
          key,
          area: tile.area,
          color: tile.color,
          count: 1,
        })
      }
    }

    return [...groups.values()].sort((a, b) => a.area.localeCompare(b.area))
  }, [tiles])

  const pushHistory = () => {
    historyRef.current = [
      ...historyRef.current.slice(-99),
      {
        tiles: tilesRef.current.map((tile) => ({ ...tile })),
        walls: wallsRef.current.map((wall) => ({ ...wall })),
      },
    ]
  }

  const undoLastChange = () => {
    const previousEntry = historyRef.current.at(-1)

    if (!previousEntry) {
      return
    }

    historyRef.current = historyRef.current.slice(0, -1)
    setTiles(previousEntry.tiles)
    setWalls(previousEntry.walls)
  }

  const getActivePaintOperation = (): PaintOperation =>
    isAltPressedRef.current ? 'subtract' : paintOperation

  const paintTile = (x: number, y: number) => {
    setTiles((currentTiles) => {
      if (getActivePaintOperation() === 'subtract') {
        return currentTiles.filter((tile) => tile.x !== x || tile.y !== y)
      }

      const name = areaName.trim() || DEFAULT_AREA_NAME
      const existingTile = currentTiles.find((tile) => tile.x === x && tile.y === y)

      if (existingTile) {
        return currentTiles.map((tile) =>
          tile.x === x && tile.y === y
            ? { ...tile, area: name, color: areaColor }
            : tile,
        )
      }

      return [...currentTiles, { x, y, type: 'floor', area: name, color: areaColor }]
    })
  }

  const applyWall = (wall: Wall) => {
    setWalls((currentWalls) => {
      const existingWall = currentWalls.some(
        (currentWall) =>
          currentWall.x === wall.x &&
          currentWall.y === wall.y &&
          currentWall.edge === wall.edge,
      )

      if (getActivePaintOperation() === 'subtract') {
        return currentWalls.filter(
          (currentWall) =>
            currentWall.x !== wall.x ||
            currentWall.y !== wall.y ||
            currentWall.edge !== wall.edge,
        )
      }

      if (existingWall) {
        return currentWalls
      }

      return [...currentWalls, wall]
    })
  }

  const fillArea = (start: Point) => {
    const tileByCell = new Map(
      tilesRef.current.map((tile) => [getCellKey(tile.x, tile.y), tile]),
    )
    const targetFillKey = getTileFillKey(
      tileByCell.get(getCellKey(start.x, start.y)),
    )
    const blockedConnections = new Set<string>()

    for (const wall of wallsRef.current) {
      const neighbor = getWallNeighbor(wall.x, wall.y, wall.edge)

      if (
        neighbor.x >= 0 &&
        neighbor.x < grid.width &&
        neighbor.y >= 0 &&
        neighbor.y < grid.height
      ) {
        blockedConnections.add(
          getConnectionKey({ x: wall.x, y: wall.y }, neighbor),
        )
      }
    }

    const visitedCells = new Set<string>()
    const queuedCells: Point[] = [start]

    while (queuedCells.length > 0) {
      const cell = queuedCells.shift()

      if (!cell) {
        continue
      }

      const key = getCellKey(cell.x, cell.y)

      if (visitedCells.has(key)) {
        continue
      }

      if (getTileFillKey(tileByCell.get(key)) !== targetFillKey) {
        continue
      }

      visitedCells.add(key)

      for (const direction of DIRECTIONS) {
        const nextX = cell.x + direction.dx
        const nextY = cell.y + direction.dy

        if (nextX < 0 || nextX >= grid.width || nextY < 0 || nextY >= grid.height) {
          continue
        }

        const blocked = blockedConnections.has(
          getConnectionKey(cell, { x: nextX, y: nextY }),
        )

        if (!blocked) {
          queuedCells.push({ x: nextX, y: nextY })
        }
      }
    }

    setTiles((currentTiles) => {
      if (getActivePaintOperation() === 'subtract') {
        return currentTiles.filter(
          (tile) => !visitedCells.has(getCellKey(tile.x, tile.y)),
        )
      }

      const name = areaName.trim() || DEFAULT_AREA_NAME
      const nextTiles = new Map(
        currentTiles.map((tile) => [getCellKey(tile.x, tile.y), tile]),
      )

      for (const key of visitedCells) {
        const [x, y] = key.split(',').map(Number)

        nextTiles.set(key, {
          x,
          y,
          type: 'floor',
          area: name,
          color: areaColor,
        })
      }

      return [...nextTiles.values()]
    })
  }

  const fitView = () => {
    setView(getFitView(grid, viewportSize))
  }

  const zoomAtPoint = (screenPoint: Point, zoomMultiplier: number) => {
    setView((currentView) => {
      const nextZoom = clamp(
        currentView.zoom * zoomMultiplier,
        MIN_ZOOM,
        MAX_ZOOM,
      )
      const worldPoint = screenToWorld(screenPoint, currentView)

      return {
        x: screenPoint.x - worldPoint.x * nextZoom,
        y: screenPoint.y - worldPoint.y * nextZoom,
        zoom: nextZoom,
      }
    })
  }

  const toggleAreaVisibility = (key: string) => {
    setHiddenAreaKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys)

      if (nextKeys.has(key)) {
        nextKeys.delete(key)
      } else {
        nextKeys.add(key)
      }

      return nextKeys
    })
  }

  const updateAreaGroup = (
    key: string,
    nextValues: { area?: string; color?: string },
  ) => {
    pushHistory()
    setTiles((currentTiles) =>
      currentTiles.map((tile) => {
        if (getAreaKey(tile.area, tile.color) !== key) {
          return tile
        }

        return {
          ...tile,
          area: nextValues.area ?? tile.area,
          color: nextValues.color ?? tile.color,
        }
      }),
    )
    setHiddenAreaKeys((currentKeys) => {
      if (!currentKeys.has(key)) {
        return currentKeys
      }

      const nextKeys = new Set(currentKeys)
      nextKeys.delete(key)
      return nextKeys
    })
  }

  const updateAreaDraft = (
    key: string,
    nextValues: { area?: string; color?: string },
  ) => {
    setAreaDrafts((currentDrafts) => ({
      ...currentDrafts,
      [key]: {
        area: nextValues.area ?? currentDrafts[key]?.area ?? DEFAULT_AREA_NAME,
        color: nextValues.color ?? currentDrafts[key]?.color ?? DEFAULT_AREA_COLOR,
      },
    }))
  }

  const applyAreaDraft = (key: string, fallbackArea: string, fallbackColor: string) => {
    const draft = areaDrafts[key]

    if (!draft) {
      return
    }

    updateAreaGroup(key, {
      area: draft.area.trim() || fallbackArea,
      color: draft.color || fallbackColor,
    })
    setAreaDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts }
      delete nextDrafts[key]
      return nextDrafts
    })
  }

  const handleGridNumberChange = (
    key: keyof GridConfig,
    value: number,
    min: number,
    max: number,
  ) => {
    const nextValue = clamp(Math.round(value || min), min, max)

    setGrid((currentGrid) => {
      const nextGrid = { ...currentGrid, [key]: nextValue }

      if (key === 'width' || key === 'height') {
        setTiles((currentTiles) =>
          currentTiles.filter(
            (tile) => tile.x < nextGrid.width && tile.y < nextGrid.height,
          ),
        )
        setWalls((currentWalls) =>
          currentWalls.filter(
            (wall) => wall.x < nextGrid.width && wall.y < nextGrid.height,
          ),
        )
      }

      return nextGrid
    })
  }

  const handleGeneratorNumberChange = (
    key: keyof GeneratorConfig,
    value: number,
    min: number,
    max: number,
  ) => {
    setGeneratorConfig((currentConfig) => ({
      ...currentConfig,
      [key]: clamp(Math.round(value || min), min, max),
    }))
  }

  const handleGenerateLayout = () => {
    pushHistory()
    const nextSeed = (generatorConfig.seed + 1) % Number.MAX_SAFE_INTEGER
    const nextGeneratorConfig = { ...generatorConfig, seed: nextSeed }
    const generatedLayout = generateLayout(grid, nextGeneratorConfig)

    setGeneratorConfig(nextGeneratorConfig)
    setTiles([])
    setWalls([])
    setTiles(generatedLayout.tiles)
    setWalls(generatedLayout.walls)
    setHiddenAreaKeys(new Set())
    setAreaDrafts({})
    setView(getFitView(grid, viewportSize))
  }

  const handleExportJson = () => {
    const areaStyles = tiles.reduce<Record<string, ExportedAreaStyle>>(
      (styles, tile) => ({
        ...styles,
        [tile.area]: { color: tile.color },
      }),
      {},
    )
    const exportedTiles = tiles.map(({ x, y, type, area }) => ({
      x,
      y,
      type,
      area,
    }))
    const exportedWalls = [
      ...new Map(
        walls.map((wall) => {
          const canonicalWall = getCanonicalWall(wall, grid)

          return [getCanonicalWallKey(canonicalWall, grid), canonicalWall]
        }),
      ).values(),
    ]
    const data = JSON.stringify(
      {
        grid,
        areaStyles,
        tiles: exportedTiles,
        areas: getExportedAreas(tiles),
        walls: exportedWalls,
      },
      null,
      2,
    )
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = 'grid.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleImportJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const parsedData: unknown = JSON.parse(text)

      if (
        typeof parsedData !== 'object' ||
        parsedData === null ||
        !Array.isArray((parsedData as { tiles?: unknown }).tiles)
      ) {
        throw new Error('JSON must contain a tiles array.')
      }

      const parsedGrid = (parsedData as { grid?: unknown }).grid
      let nextGrid = grid

      if (typeof parsedGrid === 'object' && parsedGrid !== null) {
        const { width, height, cellSize } = parsedGrid as Partial<GridConfig>

        nextGrid = {
          width:
            typeof width === 'number'
              ? clamp(Math.round(width), MIN_GRID_SIZE, MAX_GRID_SIZE)
              : grid.width,
          height:
            typeof height === 'number'
              ? clamp(Math.round(height), MIN_GRID_SIZE, MAX_GRID_SIZE)
              : grid.height,
          cellSize:
            typeof cellSize === 'number'
              ? clamp(Math.round(cellSize), MIN_CELL_SIZE, MAX_CELL_SIZE)
              : grid.cellSize,
        }
      }

      const importedTiles = new Map<string, Tile>()
      const importedWalls = new Map<string, Wall>()
      const parsedAreaStyles = (parsedData as { areaStyles?: unknown }).areaStyles
      const areaStyles: Record<string, ExportedAreaStyle> = {}

      if (typeof parsedAreaStyles === 'object' && parsedAreaStyles !== null) {
        for (const [area, style] of Object.entries(parsedAreaStyles)) {
          if (typeof style === 'string') {
            areaStyles[area] = { color: style }
            continue
          }

          if (typeof style === 'object' && style !== null) {
            const { color } = style as { color?: unknown }

            if (typeof color === 'string') {
              areaStyles[area] = { color }
            }
          }
        }
      }

      for (const tile of (parsedData as { tiles: unknown[] }).tiles) {
        if (typeof tile !== 'object' || tile === null) {
          throw new Error('Each tile must be an object.')
        }

        const { x, y, type, area, color } = tile as {
          x?: unknown
          y?: unknown
          type?: unknown
          area?: unknown
          color?: unknown
        }

        if (
          typeof x !== 'number' ||
          typeof y !== 'number' ||
          !Number.isInteger(x) ||
          !Number.isInteger(y) ||
          x < 0 ||
          x >= nextGrid.width ||
          y < 0 ||
          y >= nextGrid.height ||
          typeof type !== 'string'
        ) {
          throw new Error('Each tile must have valid x, y, and type values.')
        }

        const importedArea =
          typeof area === 'string'
            ? area
            : type === 'floor'
              ? DEFAULT_AREA_NAME
              : type

        importedTiles.set(`${x},${y}`, {
          x,
          y,
          type: 'floor',
          area: importedArea,
          color:
            areaStyles[importedArea]?.color ??
            (typeof color === 'string' ? color : DEFAULT_AREA_COLOR),
        })
      }

      const parsedWalls = (parsedData as { walls?: unknown }).walls

      if (parsedWalls !== undefined) {
        if (!Array.isArray(parsedWalls)) {
          throw new Error('Walls must be an array.')
        }

        for (const wall of parsedWalls) {
          if (typeof wall !== 'object' || wall === null) {
            throw new Error('Each wall must be an object.')
          }

          const { x, y, edge } = wall as {
            x?: unknown
            y?: unknown
            edge?: unknown
          }

          if (
            typeof x !== 'number' ||
            typeof y !== 'number' ||
            !Number.isInteger(x) ||
            !Number.isInteger(y) ||
            x < 0 ||
            x >= nextGrid.width ||
            y < 0 ||
            y >= nextGrid.height ||
            !isWallEdge(edge)
          ) {
            throw new Error('Each wall must have valid x, y, and edge values.')
          }

          const canonicalWall = getCanonicalWall({ x, y, edge }, nextGrid)
          importedWalls.set(
            getCanonicalWallKey(canonicalWall, nextGrid),
            canonicalWall,
          )
        }
      }

      pushHistory()
      setGrid(nextGrid)
      setTiles([...importedTiles.values()])
      setWalls([...importedWalls.values()])
      setHiddenAreaKeys(new Set())
      setAreaDrafts({})
    } catch (error) {
      console.error('Invalid grid JSON file:', error)
      window.alert('Invalid grid JSON file.')
    } finally {
      event.target.value = ''
    }
  }

  const handleCanvasMouseDown = (event: MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    const screenPoint = getCanvasPointFromMouseEvent(event)

    if (event.button === 1 || (event.button === 0 && isSpacePressedRef.current)) {
      isPanningRef.current = true
      lastPanPointRef.current = screenPoint
      return
    }

    if (event.button !== 0) {
      return
    }

    const worldPoint = screenToWorld(screenPoint, view)

    if (toolMode === 'fill') {
      const cell = getCellFromWorldPoint(worldPoint, grid)

      if (cell) {
        pushHistory()
        fillArea(cell)
      }

      return
    }

    isPaintingRef.current = true

    if (toolMode === 'wall') {
      const wall = getWallTargetFromWorldPoint(worldPoint, grid)
      lastPaintedWallRef.current = wall

      if (wall) {
        pushHistory()
        applyWall(wall)
      }

      return
    }

    const cell = getCellFromWorldPoint(worldPoint, grid)
    lastPaintedCellRef.current = cell

    if (cell) {
      pushHistory()
      paintTile(cell.x, cell.y)
    }
  }

  const handleCanvasMouseMove = (event: MouseEvent<HTMLCanvasElement>) => {
    const screenPoint = getCanvasPointFromMouseEvent(event)

    if (isPanningRef.current && lastPanPointRef.current) {
      const dx = screenPoint.x - lastPanPointRef.current.x
      const dy = screenPoint.y - lastPanPointRef.current.y

      lastPanPointRef.current = screenPoint
      setView((currentView) => ({
        ...currentView,
        x: currentView.x + dx,
        y: currentView.y + dy,
      }))
      return
    }

    if (!isPaintingRef.current) {
      return
    }

    const worldPoint = screenToWorld(screenPoint, view)

    if (toolMode === 'wall') {
      const wall = getWallTargetFromWorldPoint(worldPoint, grid)

      if (
        !wall ||
        (lastPaintedWallRef.current?.x === wall.x &&
          lastPaintedWallRef.current.y === wall.y &&
          lastPaintedWallRef.current.edge === wall.edge)
      ) {
        return
      }

      lastPaintedWallRef.current = wall
      applyWall(wall)
      return
    }

    const cell = getCellFromWorldPoint(worldPoint, grid)

    if (
      !cell ||
      (lastPaintedCellRef.current?.x === cell.x &&
        lastPaintedCellRef.current.y === cell.y)
    ) {
      return
    }

    lastPaintedCellRef.current = cell
    paintTile(cell.x, cell.y)
  }

  const handleCanvasWheel = (event: WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    const zoomMultiplier = event.deltaY < 0 ? 1.1 : 1 / 1.1

    zoomAtPoint(getCanvasPointFromMouseEvent(event), zoomMultiplier)
  }

  const stopPointerAction = () => {
    isPaintingRef.current = false
    isPanningRef.current = false
    lastPaintedCellRef.current = null
    lastPaintedWallRef.current = null
    lastPanPointRef.current = null
  }

  useEffect(() => {
    tilesRef.current = tiles
  }, [tiles])

  useEffect(() => {
    wallsRef.current = walls
  }, [walls])

  useEffect(() => {
    const viewport = viewportRef.current

    if (!viewport) {
      return
    }

    const updateViewportSize = () => {
      setViewportSize({ x: viewport.clientWidth, y: viewport.clientHeight })
    }
    const resizeObserver = new ResizeObserver(updateViewportSize)

    updateViewportSize()
    resizeObserver.observe(viewport)

    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      const isTextInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        if (!isTextInput) {
          event.preventDefault()
          undoLastChange()
        }

        return
      }

      if (event.key === 'Alt') {
        if (isTextInput) {
          return
        }

        event.preventDefault()
        isAltPressedRef.current = true
        return
      }

      if (event.code === 'Space') {
        if (isTextInput) {
          return
        }

        event.preventDefault()
        isSpacePressedRef.current = true
      }
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Alt') {
        isAltPressedRef.current = false
      }

      if (event.code === 'Space') {
        isSpacePressedRef.current = false
        stopPointerAction()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')

    if (!canvas || !context) {
      return
    }

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.floor(viewportSize.x * dpr))
    canvas.height = Math.max(1, Math.floor(viewportSize.y * dpr))

    context.setTransform(1, 0, 0, 1, 0, 0)
    context.fillStyle = canvasTheme === 'dark' ? '#05070a' : '#eef1f5'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.setTransform(dpr * view.zoom, 0, 0, dpr * view.zoom, dpr * view.x, dpr * view.y)

    for (const tile of tiles) {
      if (hiddenAreaKeys.has(getAreaKey(tile.area, tile.color))) {
        continue
      }

      context.fillStyle = tile.color || DEFAULT_AREA_COLOR
      traceTilePath(context, tile.x, tile.y, grid)
      context.fill()
    }

    context.strokeStyle = canvasTheme === 'dark' ? '#252b35' : '#d9d9d9'
    context.lineWidth = 1 / view.zoom
    for (let row = 0; row < grid.height; row += 1) {
      for (let column = 0; column < grid.width; column += 1) {
        traceTilePath(context, column, row, grid)
        context.stroke()
      }
    }

    context.strokeStyle = canvasTheme === 'dark' ? '#f8fafc' : '#111827'
    context.lineWidth = 3 / view.zoom
    context.lineCap = 'round'

    for (const wall of walls) {
      const { tileWidth, tileHeight } = getIsoMetrics(grid)
      const top = getTileTopPoint(wall.x, wall.y, grid)
      const right = { x: top.x + tileWidth / 2, y: top.y + tileHeight / 2 }
      const bottom = { x: top.x, y: top.y + tileHeight }
      const left = { x: top.x - tileWidth / 2, y: top.y + tileHeight / 2 }
      const points: Record<WallEdge, [Point, Point]> = {
        top: [top, right],
        right: [right, bottom],
        bottom: [bottom, left],
        left: [left, top],
      }
      const [start, end] = points[wall.edge]

      context.beginPath()
      context.moveTo(start.x, start.y)
      context.lineTo(end.x, end.y)
      context.stroke()
    }
  }, [canvasTheme, grid, hiddenAreaKeys, tiles, walls, view, viewportSize])

  return (
    <main className="app">
      <div className="toolbar" aria-label="Editor tools">
        <div className="toolbar-group" aria-label="Paint tools">
          <span className="toolbar-label">Paint</span>
          <button
            type="button"
            className={toolMode === 'wall' ? 'active' : undefined}
            onClick={() => setToolMode('wall')}
          >
            Wall
          </button>
          <button
            type="button"
            className={toolMode === 'floor' ? 'active' : undefined}
            onClick={() => setToolMode('floor')}
          >
            Floor
          </button>
          <div className="segmented-control" aria-label="Paint operation">
            <button
              type="button"
              className={paintOperation === 'add' ? 'active' : undefined}
              onClick={() => setPaintOperation('add')}
            >
              +
            </button>
            <button
              type="button"
              className={paintOperation === 'subtract' ? 'active' : undefined}
              onClick={() => setPaintOperation('subtract')}
            >
              -
            </button>
          </div>
          <button
            type="button"
            className={toolMode === 'fill' ? 'active' : undefined}
            onClick={() => setToolMode('fill')}
          >
            Fill
          </button>
          <label>
            Area
            <input
              className="area-name-input"
              type="text"
              value={areaName}
              onChange={(event) => setAreaName(event.target.value)}
            />
          </label>
          <label>
            Color
            <input
              className="color-input"
              type="color"
              value={areaColor}
              onChange={(event) => setAreaColor(event.target.value)}
            />
          </label>
        </div>

        <div className="toolbar-group clear-controls" aria-label="Clear controls">
          <button
            type="button"
            onClick={() => {
              pushHistory()
              setTiles([])
              setWalls([])
              setHiddenAreaKeys(new Set())
              setAreaDrafts({})
            }}
          >
            Clear
          </button>
        </div>

        <div className="toolbar-group generator-controls" aria-label="Generate Layout panel">
          <span className="toolbar-label">Generate Layout</span>
          <label>
            Seed
            <input
              type="number"
              value={generatorConfig.seed}
              onChange={(event) =>
                handleGeneratorNumberChange(
                  'seed',
                  Number(event.target.value),
                  0,
                  Number.MAX_SAFE_INTEGER,
                )
              }
            />
          </label>
          <label>
            Rooms
            <input
              type="number"
              min={1}
              max={100}
              value={generatorConfig.roomCount}
              onChange={(event) =>
                handleGeneratorNumberChange(
                  'roomCount',
                  Number(event.target.value),
                  1,
                  100,
                )
              }
            />
          </label>
          <label>
            Min
            <input
              type="number"
              min={1}
              max={MAX_GRID_SIZE}
              value={generatorConfig.minRoomSize}
              onChange={(event) =>
                handleGeneratorNumberChange(
                  'minRoomSize',
                  Number(event.target.value),
                  1,
                  MAX_GRID_SIZE,
                )
              }
            />
          </label>
          <label>
            Max
            <input
              type="number"
              min={1}
              max={MAX_GRID_SIZE}
              value={generatorConfig.maxRoomSize}
              onChange={(event) =>
                handleGeneratorNumberChange(
                  'maxRoomSize',
                  Number(event.target.value),
                  1,
                  MAX_GRID_SIZE,
                )
              }
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={generatorConfig.corridors}
              onChange={(event) =>
                setGeneratorConfig((currentConfig) => ({
                  ...currentConfig,
                  corridors: event.target.checked,
                }))
              }
            />
            Corridors
          </label>
          <div className="segmented-control" aria-label="Generation shape">
            <button
              type="button"
              className={generatorConfig.shape === 'free' ? 'active' : undefined}
              onClick={() =>
                setGeneratorConfig((currentConfig) => ({
                  ...currentConfig,
                  shape: 'free',
                }))
              }
            >
              Free
            </button>
            <button
              type="button"
              className={generatorConfig.shape === 'diamond' ? 'active' : undefined}
              onClick={() =>
                setGeneratorConfig((currentConfig) => ({
                  ...currentConfig,
                  shape: 'diamond',
                }))
              }
            >
              Diamond
            </button>
          </div>
          <button type="button" onClick={handleGenerateLayout}>
            Generate
          </button>
        </div>

        <div className="toolbar-group map-controls" aria-label="Map size controls">
          <span className="toolbar-label">Map</span>
          <label>
            Width
            <input
              type="number"
              min={MIN_GRID_SIZE}
              max={MAX_GRID_SIZE}
              value={grid.width}
              onChange={(event) =>
                handleGridNumberChange(
                  'width',
                  Number(event.target.value),
                  MIN_GRID_SIZE,
                  MAX_GRID_SIZE,
                )
              }
            />
          </label>
          <label>
            Height
            <input
              type="number"
              min={MIN_GRID_SIZE}
              max={MAX_GRID_SIZE}
              value={grid.height}
              onChange={(event) =>
                handleGridNumberChange(
                  'height',
                  Number(event.target.value),
                  MIN_GRID_SIZE,
                  MAX_GRID_SIZE,
                )
              }
            />
          </label>
          <label>
            Cell Size
            <input
              type="number"
              min={MIN_CELL_SIZE}
              max={MAX_CELL_SIZE}
              value={grid.cellSize}
              onChange={(event) =>
                handleGridNumberChange(
                  'cellSize',
                  Number(event.target.value),
                  MIN_CELL_SIZE,
                  MAX_CELL_SIZE,
                )
              }
            />
          </label>
        </div>

        <div className="toolbar-group file-controls" aria-label="File controls">
          <span className="toolbar-label">File</span>
          <button type="button" onClick={handleExportJson}>
            Export JSON
          </button>
          <button type="button" onClick={handleImportClick}>
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            className="file-input"
            type="file"
            accept="application/json,.json"
            onChange={handleImportJson}
          />
        </div>
      </div>

      <div ref={viewportRef} className="editor-viewport">
        <canvas
          ref={canvasRef}
          className={canvasTheme === 'dark' ? 'canvas-dark' : undefined}
          aria-label={`${grid.width} by ${grid.height} isometric layout grid`}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={stopPointerAction}
          onMouseLeave={stopPointerAction}
          onAuxClick={(event) => event.preventDefault()}
          onWheel={handleCanvasWheel}
        />
        <button
          type="button"
          className="canvas-theme-toggle"
          aria-label={
            canvasTheme === 'dark'
              ? 'Switch canvas to light mode'
              : 'Switch canvas to dark mode'
          }
          onClick={() =>
            setCanvasTheme((currentTheme) =>
              currentTheme === 'dark' ? 'light' : 'dark',
            )
          }
        >
          {canvasTheme === 'dark' ? '☀' : '☾'}
        </button>
        <div className="viewport-controls" aria-label="View controls">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() =>
              zoomAtPoint({ x: viewportSize.x / 2, y: viewportSize.y / 2 }, 1.2)
            }
          >
            +
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() =>
              zoomAtPoint(
                { x: viewportSize.x / 2, y: viewportSize.y / 2 },
                1 / 1.2,
              )
            }
          >
            -
          </button>
          <button
            type="button"
            aria-label="Reset view"
            onClick={() => setView({ x: 48, y: 48, zoom: 1 })}
          >
            R
          </button>
          <button type="button" aria-label="Fit view" onClick={fitView}>
            Fit
          </button>
        </div>
        {areaGroups.length > 0 && (
          <div className="area-legend" aria-label="Painted area legend">
            <div className="area-legend-title">Areas</div>
            {areaGroups.map((group) => {
              const hidden = hiddenAreaKeys.has(group.key)
              const draft = areaDrafts[group.key]
              const draftArea = draft?.area ?? group.area
              const draftColor = draft?.color ?? group.color

              return (
                <div
                  key={group.key}
                  className={hidden ? 'area-legend-item muted' : 'area-legend-item'}
                >
                  <input
                    className="legend-color-input"
                    type="color"
                    value={draftColor}
                    aria-label={`Change ${group.area} color`}
                    onChange={(event) =>
                      updateAreaDraft(group.key, {
                        area: draftArea,
                        color: event.target.value,
                      })
                    }
                  />
                  <input
                    className="legend-name-input"
                    type="text"
                    value={draftArea}
                    aria-label={`Rename ${group.area}`}
                    onChange={(event) =>
                      updateAreaDraft(group.key, {
                        area: event.target.value,
                        color: draftColor,
                      })
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        applyAreaDraft(group.key, group.area, group.color)
                      }
                    }}
                  />
                  <span className="area-count">{group.count}</span>
                  <button
                    type="button"
                    disabled={!draft}
                    onClick={() => applyAreaDraft(group.key, group.area, group.color)}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setToolMode('floor')
                      setPaintOperation('add')
                      setAreaName(group.area)
                      setAreaColor(group.color)
                    }}
                  >
                    Use
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleAreaVisibility(group.key)}
                  >
                    {hidden ? 'Show' : 'Hide'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

export default App
