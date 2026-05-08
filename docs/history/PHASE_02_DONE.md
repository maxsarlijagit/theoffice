# PHASE_02_DONE.md

## Qué hice
- Game loop a 20 ticks/segundo en servidor
- Input WASD/Arrow keys enviados al servidor
- Movimiento autoritativo: servidor calcula posición
- Colisiones contra tilemap (tiles 1,2,3,4,5 son sólidos)
- Broadcast de estado a todos los clientes cada tick
- Cliente solo renderiza lo que el servidor envía

## Archivos tocados
- `server/index.js` - Game loop + colisiones
- `client/index.html` - Input handling

## Cómo testear
1. `npm run dev`
2. Abrir dos pestañas en http://localhost:3000
3. Ingresar con nombres distintos
4. Mover con WASD en una pestaña
5. El avatar se mueve en ambas sin teleporting
6. Intentar atravesar pared → no pasa