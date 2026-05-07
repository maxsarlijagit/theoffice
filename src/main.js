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

    // Renderizado de tiles de suelo
    map.tiles.forEach(tile => {
        const isoX = (tile.x - tile.y) * (tileWidth / 2);
        const isoY = (tile.x + tile.y) * (tileHeight / 2);
        
        const color = Phaser.Display.Color.HexStringToColor(map.areaStyles[tile.area].color).color;
        
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
    });

    this.add.text(10, 10, "PHASER 3 ENGINE: ISO_RENDER_V1", {
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
