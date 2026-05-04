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
    // Assets will go here (rescuing from Franco/Kalil later)
}

function create() {
    console.log("Phaser Scene Created");
    this.add.text(10, 10, "Phaser 3 + Vite: Ready for Isometric", {
        fontFamily: 'Space Grotesk',
        fontSize: '20px',
        fill: '#3b82f6'
    });

    // Handle UI interaction
    const joinBtn = document.getElementById('join-btn');
    joinBtn.onclick = () => {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('game-ui').style.display = 'block';
        // Connection logic will be integrated here
    };
}

function update() {
    // Game loop logic
}

window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
});
