FEATURE | STATUS | FILE | NOTES
--------|--------|------|------
Tilemap render | IMPLEMENTED | client/index.html + art/ | Procedural sprites
Player movement | IMPLEMENTED | server/index.js | Game loop 20 ticks
WebSocket connection | IMPLEMENTED | server/index.js | ws library
Server-side auth | IMPLEMENTED | server/index.js | UUID v4
Multiplayer sync | IMPLEMENTED | server/index.js | Broadcast state
Zone system | IMPLEMENTED | server/index.js | 5 zonas
Proximity chat | IMPLEMENTED | server/index.js | 4 tiles radius
Chat bubbles | IMPLEMENTED | client/index.html | Canvas render
Global chat | IMPLEMENTED | client/index.html | Panel lateral
Avatar sprites | IMPLEMENTED | art/spriteGenerator.js | 16x16 pixel art
Sprite animation | IMPLEMENTED | art/spriteGenerator.js | 4 frames
HUD UI | IMPLEMENTED | client/index.html | Top bar, minimap
Zone labels | IMPLEMENTED | client/index.html | Notification
Discord bot | IMPLEMENTED | server/discord.js | Optional
Atmosphere effects | IMPLEMENTED | art/atmosphere.js | Partículas, scanlines, viñeta
Rate limiting | IMPLEMENTED | server/index.js | 30 msgs/sec
Heartbeat | IMPLEMENTED | server/index.js | 30s timeout
Max players | IMPLEMENTED | server/index.js | 50 limit