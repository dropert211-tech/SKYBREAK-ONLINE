# Architecture — SKYBREAK V3

`server/server.py`
- HTTP static server
- WebSocket room server
- up to 8 players per room
- live global player endpoint `/api/global`
- optional master directory `/master/register` + `/master/players`
- periodic master heartbeat
- Radmin-compatible bind on `0.0.0.0`

`client/index.html`
- STALKER-inspired Zone menu
- Chornobyl background
- network endpoint field
- live global player panel
- lobby, HUD and cinematic overlays

`client/app.js`
- Three.js scene
- procedural city
- drone
- arcade controls
- smooth remote-player interpolation
- WebSocket networking
- global directory polling
- impact VFX

`client/style.css`
- Zone palette
- animated fog/noise/scanlines
- menu transitions
- HUD animation
- responsive layout

## Network model

### Radmin
The browser connects directly to the host's Radmin VPN address:
`ws://RADMIN_IP:8001`

### Internet
The browser connects to a public game node:
`ws://PUBLIC_HOST:8001`

### Global directory
Multiple game nodes can register to one master:
`POST /master/register`

A node configured with `SKYBREAK_MASTER_URL` proxies its global list through:
`GET /master/players`

The directory contains only live game presence data: player name, room and server label.
