# The Office - Phaser 4

Isometric office prototype built with Phaser 4 and Vite.

## Stack

- Frontend: Vite
- Game runtime: Phaser 4
- Map data: `maps/map1.json`
- Map editor: `iso-layout-editor/`

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:5173 in the browser.

## Controls

- WASD or Arrow keys: Move

## Useful Scripts

```bash
npm run dev      # Phaser game
npm run build    # Production build
npm run preview  # Preview built app
npm run editor   # Map editor
```

## Features

- Isometric tile rendering
- Area-based zone colors
- Player movement with foot-point collision
- Walls, doors, furniture blockers, and depth sorting
