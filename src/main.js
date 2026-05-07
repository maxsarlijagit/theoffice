import Phaser from 'phaser';

// Layer Constants for Z-Sorting
const LAYERS = {
    FLOOR: 0,
    FURNITURE: 10,
    WALL: 20,
    PLAYER: 30
};

// Helper to calculate depth based on grid position and layer
const getDepth = (x, y, layer) => {
    // In isometric, depth is primarily x + y
    // We multiply by 100 to leave space for sub-layers if needed
    return (x + y) * 100 + layer;
};

// Phaser Game Configuration
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#0d1117',
    pixelArt: true,
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

function preload() {
    this.load.json('mapData', 'assets/data/map_v1.json');
}

function create() {
    const map = this.cache.json.get('mapData');
    const { cellSize } = map.grid;
    
    // Proyección isométrica base (ratio 2:1)
    const tileWidth = cellSize;
    const tileHeight = cellSize / 2;
    const originX = this.cameras.main.centerX;
    const originY = this.cameras.main.centerY - (map.grid.height * tileHeight / 4);

    // Renderizado de tiles de suelo
    map.tiles.forEach(tile => {
        const isoX = (tile.x - tile.y) * (tileWidth / 2);
        const isoY = (tile.x + tile.y) * (tileHeight / 2);
        
        const color = Phaser.Display.Color.HexStringToColor(map.areaStyles[tile.area].color).color;
        
        const graphics = this.add.graphics();
        graphics.fillStyle(color, 0.8);
        graphics.lineStyle(1, 0xffffff, 0.2);
        
        const points = [
            { x: originX + isoX, y: originY + isoY },
            { x: originX + isoX + tileWidth / 2, y: originY + isoY + tileHeight / 2 },
            { x: originX + isoX, y: originY + isoY + tileHeight },
            { x: originX + isoX - tileWidth / 2, y: originY + isoY + tileHeight / 2 }
        ];
        
        graphics.fillPoints(points, true);
        graphics.strokePoints(points, true);
        graphics.setDepth(getDepth(tile.x, tile.y, LAYERS.FLOOR));
    });

    // Renderizado de muebles (Placeholders)
    if (map.furniture) {
        map.furniture.forEach(item => {
            const isoX = (item.x - item.y) * (tileWidth / 2);
            const isoY = (item.x + item.y) * (tileHeight / 2);
            
            const graphics = this.add.graphics();
            
            if (item.type === 'placeholder_cube') {
                // Dibujar un cubo simple
                const h = 20; // altura del cubo
                const basePoints = [
                    { x: originX + isoX, y: originY + isoY + tileHeight / 2 },
                    { x: originX + isoX + tileWidth / 2, y: originY + isoY + tileHeight },
                    { x: originX + isoX, y: originY + isoY + tileHeight * 1.5 },
                    { x: originX + isoX - tileWidth / 2, y: originY + isoY + tileHeight }
                ];
                
                // Cara superior
                graphics.fillStyle(0xaaaaaa, 1);
                graphics.fillPoints(basePoints.map(p => ({ x: p.x, y: p.y - h })), true);
                
                // Caras laterales
                graphics.fillStyle(0x888888, 1);
                graphics.fillPoints([
                    { x: basePoints[1].x, y: basePoints[1].y },
                    { x: basePoints[1].x, y: basePoints[1].y - h },
                    { x: basePoints[2].x, y: basePoints[2].y - h },
                    { x: basePoints[2].x, y: basePoints[2].y }
                ], true);
                
                graphics.fillStyle(0x666666, 1);
                graphics.fillPoints([
                    { x: basePoints[2].x, y: basePoints[2].y },
                    { x: basePoints[2].x, y: basePoints[2].y - h },
                    { x: basePoints[3].x, y: basePoints[3].y - h },
                    { x: basePoints[3].x, y: basePoints[3].y }
                ], true);
            } else {
                // Placeholder plano (alfombra o similar)
                graphics.fillStyle(0xffff00, 0.5);
                const points = [
                    { x: originX + isoX, y: originY + isoY },
                    { x: originX + isoX + tileWidth / 2, y: originY + isoY + tileHeight / 2 },
                    { x: originX + isoX, y: originY + isoY + tileHeight },
                    { x: originX + isoX - tileWidth / 2, y: originY + isoY + tileHeight / 2 }
                ];
                graphics.fillPoints(points, true);
            }
            
            graphics.setDepth(getDepth(item.x, item.y, LAYERS.FURNITURE));
        });
    }

    // Renderizado de paredes
    map.walls.forEach(wall => {
        const isoX = (wall.x - wall.y) * (tileWidth / 2);
        const isoY = (wall.x + wall.y) * (tileHeight / 2);
        
        const top = { x: originX + isoX, y: originY + isoY };
        const right = { x: originX + isoX + tileWidth / 2, y: originY + isoY + tileHeight / 2 };
        const bottom = { x: originX + isoX, y: originY + isoY + tileHeight };
        const left = { x: originX + isoX - tileWidth / 2, y: originY + isoY + tileHeight / 2 };

        const wallGraphics = this.add.graphics();
        wallGraphics.lineStyle(4, 0xffffff, 0.8);

        if (wall.edge === 'top') {
            wallGraphics.lineBetween(top.x, top.y, right.x, right.y);
        } else if (wall.edge === 'right') {
            wallGraphics.lineBetween(right.x, right.y, bottom.x, bottom.y);
        } else if (wall.edge === 'bottom') {
            wallGraphics.lineBetween(bottom.x, bottom.y, left.x, left.y);
        } else if (wall.edge === 'left') {
            wallGraphics.lineBetween(left.x, left.y, top.x, top.y);
        }

        wallGraphics.setDepth(getDepth(wall.x, wall.y, LAYERS.WALL));
    });

    // Player Placeholder (Diamante que sigue al mouse)
    this.player = this.add.graphics();
    this.player.fillStyle(0x00ff00, 1);
    const playerPoints = [
        { x: 0, y: -tileHeight / 2 },
        { x: tileWidth / 4, y: 0 },
        { x: 0, y: tileHeight / 2 },
        { x: -tileWidth / 4, y: 0 }
    ];
    this.player.fillPoints(playerPoints, true);
    this.player.lineStyle(2, 0xffffff, 1);
    this.player.strokePoints(playerPoints, true);

    this.add.text(10, 10, "PHASER 3 ENGINE: ISO_RENDER_V2 (LAYERED Z-SORT)", {
        fontFamily: 'JetBrains Mono',
        fontSize: '16px',
        fill: '#ffffff'
    });

    // Contexto de grilla para el player
    this.gridOriginX = originX;
    this.gridOriginY = originY;
    this.tileW = tileWidth;
    this.tileH = tileHeight;

    // Control de UI (Rescatado de la versión anterior)
    const joinBtn = document.getElementById('join-btn');
    if (joinBtn) {
        joinBtn.onclick = () => {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('game-ui').style.display = 'block';
        };
    }

    // Inicialización de Color Picker (iro.js)
    if (window.iro) {
        new window.iro.ColorPicker("#color-wheel", {
            width: 150,
            color: "#3b82f6",
            layout: [
                { component: window.iro.ui.Wheel }
            ]
        });
    }
}

function update() {
    // Seguir al mouse y calcular profundidad en tiempo real
    const pointer = this.input.activePointer;
    
    // Inversión de la proyección isométrica (aproximada para el mouse)
    const relX = pointer.x - this.gridOriginX;
    const relY = pointer.y - this.gridOriginY;
    
    // Ajuste fino para la detección de la celda bajo el cursor
    const gridX = Math.floor((relY / (this.tileH / 2) + relX / (this.tileW / 2)) / 2);
    const gridY = Math.floor((relY / (this.tileH / 2) - relX / (this.tileW / 2)) / 2);
    
    this.player.x = pointer.x;
    this.player.y = pointer.y;
    
    // Actualizar depth dinámicamente
    this.player.setDepth(getDepth(gridX, gridY, LAYERS.PLAYER));
}

window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
});
