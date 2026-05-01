# PHASE_03_DONE.md

## Qué hice
- Definí las 5 zonas como rectángulos en server/index.js
- En cada tick calculo la zona del jugador
- Emito eventos zone_enter/zone_leave al cambiar de zona
- Cliente actualiza el UI con notification + top bar

## Zonas implementadas
- OFFICE (0-17, 0-10)
- FOCUS_ROOM (18-26, 0-10)  
- CAFETERIA (27-35, 0-10)
- ARCADE (0-8, 11-21)
- STUDIO (9-26, 11-21)

## Archivos tocados
- `server/index.js` - Lógica de zonas
- `client/index.html` - UI de zona

## Cómo testear
1. `npm run dev`
2. Abrir el juego
3. Caminar entre zonas
4. El label en el top bar cambia
5. La notificación flota al entrar a nueva zona