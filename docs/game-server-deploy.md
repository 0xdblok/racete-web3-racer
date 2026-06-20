# Game Server Deployment Guide

The Colyseus game server runs **separately** from the Next.js frontend.  
Vercel handles the Next.js app; Colyseus needs a persistent host (VPS, Railway, Fly.io, Render).

---

## Local Development

```bash
# Terminal 1: Start the game server
cd server
npm install
npm run dev
# → Colyseus listening on ws://localhost:2567

# Terminal 2: Start Next.js
cd ..
npm run dev
# → Next.js on http://localhost:3000
```

The Next.js app connects to `NEXT_PUBLIC_GAME_SERVER_URL=http://localhost:2567`.

---

## Production Deployment

### Option A: VPS with PM2

```bash
# On your VPS
cd /opt/racete-game-server
git clone <repo> .
cd server
npm install
npm run build

# Start with PM2
pm2 start dist/index.js --name racete-game-server
pm2 save
pm2 startup
```

### Option B: Railway / Render / Fly.io

- Set the **build command**: `cd server && npm install && npm run build`
- Set the **start command**: `cd server && node dist/index.js`
- Set **port** env var: `GAME_SERVER_PORT=2567`

### Option C: Single VPS (both Next.js + Colyseus)

If running both on one machine:

```bash
# Colyseus
GAME_SERVER_PORT=2567 CORS_ORIGIN=https://yoursite.com node server/dist/index.js

# Next.js (behind nginx on :3000)
NEXT_PUBLIC_GAME_SERVER_URL=https://yoursite.com:2567 npm start
```

---

## Environment Variables for Server

```
GAME_SERVER_PORT=2567
CORS_ORIGIN=http://localhost:3000    # In production: https://yourdomain.com
```

---

## Environment Variables for Frontend

```
NEXT_PUBLIC_GAME_SERVER_URL=http://localhost:2567
```

In production, set this to:
```
NEXT_PUBLIC_GAME_SERVER_URL=wss://game.yourdomain.com
```

If using nginx reverse proxy:
```
# nginx config snippet
location /colyseus/ {
    proxy_pass http://localhost:2567/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

Then:
```
NEXT_PUBLIC_GAME_SERVER_URL=wss://yourdomain.com/colyseus
```

---

## Firewall / Ports

- **2567** — Colyseus WebSocket server (must be reachable by clients)
- **3000** — Next.js (only if not proxied through Vercel)
- The Colyseus port must be open to the internet for WebSocket connections

---

## Verification

```bash
# Health check
curl http://localhost:2567/health
# → {"status":"ok","uptime":...}

# Check rooms
# Visit http://localhost:2567/colyseus in browser (if Colyseus monitor UI is enabled)

# Frontend connectivity
# Open the app, connect wallet, click "Find Match" on /race/multiplayer
# Check server logs for: [RaceRoom] Created room ... for class ...
```

---

## Notes

- In V1, the game server does **not** connect to Supabase. All DB writes happen from Next.js API routes.
- The Colyseus server only handles: room lifecycle, player state, countdown, race start signal.
- Position sync and race results will be added in a later phase.
- No Redis or external message broker needed yet.
