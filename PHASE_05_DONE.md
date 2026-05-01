# PHASE_05_DONE.md

## Qué hice
- Múltiples jugadores se ven simultáneamente
- Nombres sobre avatares
- Contador de jugadores online en tiempo real
- Al desconectar, el avatar desaparece de las demás pantallas

## Archivos tocados
- `server/index.js` - lógica de join/left/broadcast
- `client/index.html` - rendering de múltiples players

## Cómo testear
1. Abrir 3 pestañas
2. Ingresar con nombres distintos
3. Los 3 avatares aparecen en todas las pestañas
4. Cerrar una pestaña → desaparece de las otras