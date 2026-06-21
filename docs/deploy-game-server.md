# Deploying the Racete Game Server

The Colyseus WebSocket game server runs separately from the Next.js Vercel frontend. It must run on a VPS (or any host with a public IP) because Vercel cannot host persistent WebSocket processes.

## Prerequisites

- Node.js 20+
- npm
- A VPS with a public IP (or domain)
- PM2 (optional but recommended for production)

## Quick Start (Local Dev)

```bash
cd server
npm install
npm run dev
```

Server starts on `ws://localhost:2567` with health at `http://localhost:2567/health`.

Set `NEXT_PUBLIC_GAME_SERVER_URL=ws://localhost:2567` in your frontend `.env.local`.

---

## Production Deployment

### 1. Install dependencies & build

```bash
cd /root/racete-web3-racer/server
npm install
npm run build
```

Output goes to `dist/`.

### 2. Configure environment

Copy and edit the env file:

```bash
cp .env.example .env
```

Edit `.env`:

```
GAME_SERVER_PORT=2567
CORS_ORIGIN=https://your-vercel-domain.vercel.app
```

### 3. Run with PM2

```bash
# Install PM2 if not already installed
npm install -g pm2

# Start the server
pm2 start dist/index.js --name racete-game-server

# Save PM2 process list (auto-start on reboot)
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### 4. Verify

```bash
# Check PM2 status
pm2 status

# Health check
curl http://localhost:2567/health
# → {"status":"ok","uptime":...}

# Check logs
pm2 logs racete-game-server
```

---

## Nginx Reverse Proxy (WSS + SSL)

Because the Vercel frontend is HTTPS, WebSocket connections must use WSS (secure WebSocket). Nginx handles SSL termination and proxies to the Colyseus server.

### Example Nginx config (`/etc/nginx/sites-available/game`)

```nginx
server {
    listen 80;
    server_name game.yourdomain.com;

    # Redirect HTTP to HTTPS (after certbot)
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name game.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/game.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/game.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:2567;
        proxy_http_version 1.1;

        # Required for WebSocket upgrade
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Increase timeouts for long-lived WebSocket connections
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

### SSL with Certbot

```bash
# Install certbot
apt install certbot python3-certbot-nginx

# Get certificate
certbot --nginx -d game.yourdomain.com
```

### Enable the site

```bash
ln -s /etc/nginx/sites-available/game /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## Vercel Environment Variable

Set in your Vercel project dashboard:

```
NEXT_PUBLIC_GAME_SERVER_URL=wss://game.yourdomain.com
```

For local dev only:
```
NEXT_PUBLIC_GAME_SERVER_URL=ws://localhost:2567
```

---

## Firewall

If the server is directly exposed (no Nginx proxy):

```bash
ufw allow 2567/tcp
```

With Nginx proxy, only allow 443:

```bash
ufw allow 443/tcp
```

---

## No Domain? Temporary Options

⚠️ **Warning:** HTTPS frontends may block insecure `ws://` connections to raw IPs. Most browsers block mixed content (connecting to `ws://` from an `https://` page).

Options:
1. Get a free domain + use Cloudflare/Let's Encrypt for SSL
2. Use a Cloudflare Tunnel (Argo) to expose `localhost:2567` with SSL
3. Use `ngrok` for testing: `ngrok tcp 2567`

Do NOT deploy to production with `ws://` — it will be blocked by browsers on HTTPS pages.
