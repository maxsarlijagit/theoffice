import Phaser from 'phaser';

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
    // Carga del mapa base generado para validación técnica
    this.load.json('mapData', 'assets/data/map_v1.json');
}

function create() {
    const map = this.cache.json.get('mapData');
    const { cellSize } = map.grid;
    
    // Proyección isométrica base (ratio 2:1)
    const tileWidth = cellSize;
    const tileHeight = cellSize / 2;
    const originX = this.cameras.main.centerX;
    const originY = this.cameras.main.centerY - (map.grid.height * tileHeight / 2);

    // Renderizado de tiles de suelo con Z-Sorting
    map.tiles.forEach(tile => {
        const isoX = (tile.x - tile.y) * (tileWidth / 2);
        const isoY = (tile.x + tile.y) * (tileHeight / 2);
        
        const color = Phaser.Display.Color.HexStringToColor(map.areaStyles[tile.area].color).color;
        
        // Se crea un objeto Graphics individual para permitir el uso de Depth
        const graphics = this.add.graphics();
        graphics.fillStyle(color, 0.8);
        graphics.lineStyle(1, 0xffffff, 0.3);
        
        const points = [
            { x: originX + isoX, y: originY + isoY },
            { x: originX + isoX + tileWidth / 2, y: originY + isoY + tileHeight / 2 },
            { x: originX + isoX, y: originY + isoY + tileHeight },
            { x: originX + isoX - tileWidth / 2, y: originY + isoY + tileHeight / 2 }
        ];
        
        graphics.fillPoints(points, true);
        graphics.strokePoints(points, true);

        // Z-Sorting: El depth es proporcional a la posición Y proyectada
        // Se suma el isoY para que tiles "más abajo" se dibujen sobre los "más arriba"
        graphics.setDepth(isoY);
    });

    // Renderizado de paredes con Z-Sorting
    map.walls.forEach(wall => {
        const isoX = (wall.x - wall.y) * (tileWidth / 2);
        const isoY = (wall.x + wall.y) * (tileHeight / 2);
        
        const top = { x: originX + isoX, y: originY + isoY };
        const right = { x: originX + isoX + tileWidth / 2, y: originY + isoY + tileHeight / 2 };
        const bottom = { x: originX + isoX, y: originY + isoY + tileHeight };
        const left = { x: originX + isoX - tileWidth / 2, y: originY + isoY + tileHeight / 2 };

        const wallGraphics = this.add.graphics();
        wallGraphics.lineStyle(4, 0xffffff, 1); // Pared blanca sólida de 4px

        if (wall.edge === 'top') {
            wallGraphics.lineBetween(top.x, top.y, right.x, right.y);
        } else if (wall.edge === 'right') {
            wallGraphics.lineBetween(right.x, right.y, bottom.x, bottom.y);
        } else if (wall.edge === 'bottom') {
            wallGraphics.lineBetween(bottom.x, bottom.y, left.x, left.y);
        } else if (wall.edge === 'left') {
            wallGraphics.lineBetween(left.x, left.y, top.x, top.y);
        }

        // El depth de la pared es el mismo que el del tile para mantener consistencia
        wallGraphics.setDepth(isoY + 1); // +1 para asegurar que esté sobre el tile de suelo
    });

    this.add.text(10, 10, "PHASER 3 ENGINE: ISO_RENDER_V1 (Z-SORT ACTIVE)", {
        fontFamily: 'JetBrains Mono',
        fontSize: '16px',
        fill: '#ffffff'
    });

    // Control de UI
    const joinBtn = document.getElementById('join-btn');
    if (joinBtn) {
        joinBtn.onclick = () => {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('game-ui').style.display = 'block';
        };
    }
}

function update() {
    // Game loop logic
}

window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
});
