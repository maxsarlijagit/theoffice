# The Office — Discord Activity

Una oficina virtual 2D multijugador dentro de Discord.

## Concepto

Los equipos remotos tienen un espacio de presencia ambient donde ver a sus colegas trabajar sin videollamada. Cada persona es un personaje 2D customizable que se mueve por un mapa tile-based.

## Zonas

- **Open Office** — Zona central, lo-fi, body doubling
- **Focus Room** — Silencio, estado "en foco"
- **Cafetería** — Social, música upbeat
- **Arcade** — Minijuegos, leaderboards
- **Estudio** — Presentaciones, streams

## Tech Stack

- Backend: Node.js + WebSockets
- Frontend: Canvas 2D / Phaser
- Hosting: Railway / VPS

## Roadmap

### Milestone 1: Prototipo
- [ ] Servidor WebSocket básico
- [ ] Cliente Canvas con mapa tile
- [ ] Movimiento de personaje
- [ ] Sincronización de posiciones

### Milestone 2: Multiplayer
- [ ] Múltiples clientes conectados
- [ ] Presencia en tiempo real
- [ ] Sistema de zonas

### Milestone 3: Discord Activity
- [ ] Integración Discord Activity API
- [ ] Customización de avatar
- [ ] Música por zona

## Equipo

| Rol | Integrante |
|----|-----------|
| PM | Igor Gopkalo Streiff |
| Developer | Max Sarlija, Manuel Mejia |
| Tech Artist | Mariano Zulueta, Kalil Fiat, Manuel Castellani, Mauricio van der Wildt, Facundo Villarreal |
| Artist | Franco Ferrarello, Alejandro Arteaga |

## Links

- Repo: https://github.com/maxsarlijagit/theoffice
- Design Bible: `the_office_discord.pdf`
