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

- Backend: Node.js + WebSockets (Railway)
- Frontend: Canvas 2D
- Hosting: Railway

## Roadmap

### Milestone 1: ✅ Prototipo (COMPLETO)
- [x] Servidor WebSocket básico
- [x] Cliente Canvas con mapa tile
- [x] Movimiento de personaje
- [x] Multiplayer live en Railway

### Milestone 2: En progreso
- [ ] **Arte placeholder** → Artists crean sprites temporales
- [ ] **Sistema decustomización** → Elegir color/avatar
- [ ] **Música por zona** → Audio embebido o streaming
- [ ] **Focus Room estado** → Indicador visual "en foco"

### Milestone 3: Discord Activity
- [ ] **Discord Activity API** → Integración oficial
- [ ] **Rich Presence** → Estado en perfil Discord
- [ ] **Voice channel sync** → Sincronizar con canales de voz

### Milestone 4: Minijuegos
- [ ] **Arcade games** → Juegos simples en zona Arcade
- [ ] **Leaderboards** → Rankings por servidor
- [ ] **Events** → Eventos periódicos

---

## Assets Needed (placeholder / final)

| Asset | Status | Notas |
|-------|--------|-------|
| Sprite base player | 🔴 PENDIENTE | 32x32, capa separable |
| Sprites zonas | 🔴 PENDIENTE | Fondo tile-based |
| Iconos UI | 🔴 PENDIENTE | Botones, badges |
| Música Lo-Fi | 🔴 PENDIENTE | Loop, royalty-free |
| Música Upbeat | 🔴 PENDIENTE | Loop, royalty-free |
| SFX movimientos | 🔴 PENDIENTE | Opcional |

---

## Equipo

| Rol | Integrante |
|----|-----------|
| PM | Igor Gopkalo Streiff |
| Developer | Max Sarlija, Manuel Mejia |
| Tech Artist | Mariano Zulueta, Kalil Fiat, Manuel Castellani, Mauricio van der Wildt, Facundo Villarreal |
| Artist | Franco Ferrarello, Alejandro Arteaga |

## Links

- Repo: https://github.com/maxsarlijagit/theoffice
- Live: https://theoffice-production.up.railway.app
