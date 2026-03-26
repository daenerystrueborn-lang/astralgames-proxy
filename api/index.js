const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();

// ── CORS preflight ────────────────────────────────────
app.options("*", (req, res) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.status(204).end();
});

// ── Proxy /api/* → VPS backend ────────────────────────
// IMPORTANT: Do NOT add express.json() before this — it consumes
// the request body and breaks the proxy's ability to forward it.
app.use(
  "/api",
  createProxyMiddleware({
    target: "http://194.58.66.199:6253",
    changeOrigin: true,
    proxyTimeout: 25000,   // 25s — under Vercel's 30s maxDuration
    timeout: 25000,
    on: {
      error: (err, req, res) => {
        console.error("[proxy] error:", err.message);
        if (!res.headersSent) {
          res.status(502).json({ error: "Backend unavailable. Try again shortly." });
        }
      },
    },
  })
);

module.exports = app;
