const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();

app.use("/", createProxyMiddleware({
  target: "http://194.58.66.199:6253",
  changeOrigin: true
}));

module.exports = app;
