const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const path = require("path");
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
    target: "http://217.154.201.164:8748",
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

// ── Serve static PWA files ────────────────────────────
// Put your pwa/ folder contents in a "public/" folder in this project
app.use(express.static(path.join(__dirname, "public")));

// ── Fallback: serve index.html for any unmatched route ─
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

module.exports = app;
