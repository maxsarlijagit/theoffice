# 🏢 The Office - Multiplayer Isometric Game

Una simulación de oficina multijugador en tiempo real con perspectiva isométrica 32x32, chat de proximidad y arquitectura escalable.

## 🚀 Tecnologías
- **Motor:** Phaser 3 (Rendering Isométrico + Z-Sorting)
- **Frontend:** Vite + TypeScript
- **Backend:** Node.js + Express + WebSocket (ws)
- **Seguridad:** Parches contra XSS y gestión de sesiones por TTL.

## 🛠️ Setup del Proyecto

### Requisitos
- Node.js (v18+)
- npm

### Instalación
```bash
npm install
```

### Ejecución (Modo Desarrollo)
Levanta tanto el servidor como el cliente Phaser en paralelo:
```bash
npm run dev
```
- **Servidor:** http://localhost:5173 (Proxy via Vite)
- **Cliente:** http://localhost:5173

## 🏗️ Herramientas de Equipo

### Editor de Layout Isométrico
Para diseñar la oficina y exportar los datos de colisiones/terreno:
```bash
npm run editor
```

## 📁 Estructura del Proyecto
- `/src`: Lógica del cliente Phaser 3.
- `/server`: Lógica del servidor Node.js y WebSockets.
- `/public/assets`: Sprites, Tilesets y datos de mapas (JSON).
- `/iso-layout-editor`: Herramienta personalizada de diseño de niveles.
- `/docs`: Documentación técnica y bitácoras de gestión.

---
*Desarrollado para el TechArt Curso - Pivot Isométrico 2026.*
