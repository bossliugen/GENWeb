const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/**
 * Load key=value pairs from local .env file if present (without overriding existing env vars).
 */
function loadLocalEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    let val = line.slice(eqIndex + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

loadLocalEnv();

const PORT = Number(process.env.PORT) || 3000;
const INDEX_PATH = path.join(__dirname, "public", "index.html");

// Simple in-memory rate limiter for /api/unlock: max 10 attempts per 60s per IP
const RATE_WINDOW_MS = 60 * 1000;
const MAX_ATTEMPTS = 10;
const attemptsByIp = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const entry = attemptsByIp.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    attemptsByIp.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

function sha256(text) {
  return crypto.createHash("sha256").update(String(text), "utf8").digest();
}

function verifyPassword(inputPassword, expectedPassword) {
  if (typeof inputPassword !== "string" || !expectedPassword) return false;
  return crypto.timingSafeEqual(sha256(inputPassword), sha256(expectedPassword));
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(body);
}

function readJsonBody(req, maxBytes = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function getPrivateSites() {
  const raw = process.env.PRIVATE_SITES_JSON;
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

const server = http.createServer(async (req, res) => {
  const urlPath = (req.url || "/").split("?")[0];

  if (req.method === "GET" && (urlPath === "/" || urlPath === "/index.html")) {
    try {
      const html = fs.readFileSync(INDEX_PATH, "utf8");
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "X-Content-Type-Options": "nosniff"
      });
      res.end(html);
    } catch {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Failed to load index.html");
    }
    return;
  }

  if (req.method === "GET" && urlPath === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && urlPath === "/api/unlock") {
    const clientIp =
      (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() ||
      req.socket.remoteAddress ||
      "unknown";

    if (isRateLimited(clientIp)) {
      sendJson(res, 429, { ok: false, error: "嘗試次數過多，請稍後再試。" });
      return;
    }

    const expectedPassword = process.env.PRIVATE_PASSWORD;
    if (!expectedPassword) {
      sendJson(res, 500, { ok: false, error: "伺服器尚未設定 PRIVATE_PASSWORD。" });
      return;
    }

    try {
      const body = await readJsonBody(req);
      if (!verifyPassword(body.password, expectedPassword)) {
        sendJson(res, 401, { ok: false, error: "密碼錯誤。" });
        return;
      }

      const sites = getPrivateSites();
      sendJson(res, 200, { ok: true, sites });
    } catch (err) {
      sendJson(res, 400, { ok: false, error: err.message || "請求格式錯誤。" });
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`Showcase server running at http://localhost:${PORT}`);
});
