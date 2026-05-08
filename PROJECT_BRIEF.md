# PROJECT_BRIEF.md - The Office Virtual

Lectura rapida para futuras sesiones de trabajo sobre este proyecto.

## Objetivo del proyecto

Crear una oficina virtual isometrica, primero en modo local y luego preparada para multijugador. La base actual ya permite mover un personaje por un mapa dividido en zonas. La prioridad de esta etapa es consolidar la estructura jugable: mapa, zonas, colisiones, puertas, objetos, orden visual y una arquitectura que despues pueda sincronizarse por red.

## Stack actual

- Frontend: Vite + Phaser.
- Entrada principal del juego: `src/main.js`.
- HTML principal: `index.html`.
- Layout del mapa: `maps/map1.json`.
- Editor de mapas: `iso-layout-editor/`.
- Scripts utiles:
  - `npm run dev`
  - `npm run build`
  - `npm run editor`

## Estado del juego

- El mapa se renderiza en isometrico usando tiles de `64x32`.
- Las coordenadas se convierten con:
  - `gridToIso(x, y)`
  - `isoToGrid(x, y)`
- El personaje se mueve con WASD o flechas.
- El movimiento actual valida el punto de los pies contra tiles caminables.
- La zona actual se detecta desde la tile bajo los pies y se muestra en la UI.
- El spawn sale de la zona `Spawn` si existe.

## Zonas del mapa

El JSON actual define estas zonas:

- `Yard`
- `Study`
- `Open_Office`
- `Focus`
- `Arcade`
- `Coffee`
- `Spawn`

Los colores de cada zona estan en `layout.areaStyles`.

## Convenciones importantes

- No asumir que el mapa es rectangular completo: usar `layout.tiles` y `tilesByKey`.
- Para colisiones, trabajar desde el punto de los pies del personaje, no desde el centro visual.
- En isometrico, el orden visual debe depender de la profundidad `y`:
  - jugador mas abajo: se dibuja delante;
  - objeto/pared mas abajo: tapa al jugador si el jugador pasa por detras.
- Evitar assets complejos en esta fase. Los cubos/volumenes simples sirven para probar colision y oclusion.
- Pensar todo como futura data sincronizable para multijugador: posiciones, zonas, puertas, obstaculos y colliders deberian poder expresarse como datos.

## Trabajo reciente

Se empezo a agregar en `src/main.js`:

- Generacion automatica de paredes desde los bordes entre zonas.
- Huecos de puertas en fronteras entre zonas.
- Paredes con volumen visual.
- Colliders de pared.
- Cubos/objetos de prueba con volumen.
- Bloqueo de tiles ocupadas por objetos.
- Profundidad dinamica para que personaje, paredes y objetos puedan ocultarse entre si.

Revisar y probar esa implementacion antes de ampliarla.

## Riesgos tecnicos

- Si el radio del collider de pared es muy grande, las puertas pueden sentirse estrechas.
- Si las paredes se generan en todos los bordes entre zonas, algunas fronteras irregulares pueden quedar visualmente densas.
- Los objetos actualmente son placeholders; conviene moverlos luego a un archivo de datos separado.
- Si se retoma multijugador, hacerlo como una capa nueva alineada con `maps/map1.json`; el prototipo WebSocket/Canvas viejo fue retirado del flujo activo.

## Siguiente paso recomendado

1. Ejecutar `npm run build`.
2. Probar `npm run dev` en navegador.
3. Recorrer todas las zonas y verificar:
   - que las puertas conectan las zonas;
   - que las paredes bloquean;
   - que no hay puertas inaccesibles;
   - que el personaje se oculta correctamente detras de paredes/cubos;
   - que no queda atrapado en spawn.
4. Si funciona, extraer `wallSegments`, puertas y `furnitureItems` a un modulo/data file para que sea mas facil editar el layout.
