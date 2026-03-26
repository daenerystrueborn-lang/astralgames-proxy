# ✦ AstralRPG PWA — Setup Guide

## Files
```
yatopwa/
├── index.html          ← Main app shell
├── style.css           ← Lit Purple theme
├── app.js              ← All frontend logic
├── manifest.json       ← PWA installability
├── sw.js               ← Service worker (offline)
├── backend-bridge.js   ← Paste into your bot (Express API)
├── images/
│   ├── default-pfp.png     ← ⬅ Drop your default avatar here
│   ├── default-banner.png  ← ⬅ Drop your default banner here
│   └── loading-bg.png      ← ⬅ Drop your loading screen art here
└── icons/
    ├── icon-192.png    ← ⬅ App icon (192×192)
    └── icon-512.png    ← ⬅ App icon (512×512)
```

## Quick Start

### 1. Add your images
Rename your files exactly:
| Your file         | Rename to              |
|-------------------|------------------------|
| Profile picture   | `images/default-pfp.png`    |
| Banner/cover      | `images/default-banner.png` |
| Loading screen    | `images/loading-bg.png`     |
| App icon small    | `icons/icon-192.png`        |
| App icon large    | `icons/icon-512.png`        |

### 2. Add the backend bridge to your bot

```js
// At the top of your index2.js or handler.js:
import './backend-bridge.js'
```

Or if you want it in a separate process:
```
node backend-bridge.js
```

### 3. Install express + cors (if not already installed)
```
npm install express cors
```

### 4. Serve the PWA
Put all the PWA files in a folder called `pwa/` inside your bot directory:
```
your-bot/
├── lib/
├── plugins/
├── pwa/           ← Put index.html, style.css, app.js etc here
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   ├── manifest.json
│   ├── sw.js
│   └── images/
└── backend-bridge.js
```

### 5. Access the PWA
- Local: `http://localhost:3001`
- Deployed: `https://your-bot-domain.com`

## How Players Use It
1. Open the PWA URL on their phone
2. Tap "Add to Home Screen" to install it
3. Enter their WhatsApp number (must be registered with `!register` first)
4. View their profile, stats, leaderboard, shop, guilds

## API Endpoints
| Endpoint                  | Returns                        |
|---------------------------|--------------------------------|
| `GET /api/player/:phone`  | Single player profile          |
| `GET /api/leaderboard`    | Top 20 by level/kills/gold     |
| `GET /api/shop`           | Shop items                     |
| `GET /api/guilds`         | All guilds                     |
| `GET /api/ping`           | Health check                   |

## Hosting Tips
- **Railway**: Set `PORT` env var, it auto-detects
- **Render**: Free tier works, set start command to `node index.js`
- **VPS**: Use nginx as a reverse proxy in front of port 3001
- **Replit**: Works out of the box with the public URL
