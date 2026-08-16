const http = require("http");
const https = require("https");
const { Servers, pingLogs } = require("../config/db");

/**
 * Measures round-trip time by timing an HTTP request to a node's
 * edge-agent /health endpoint.
 *
 * IMPORTANT FIX: this used to TCP-connect to `wireguardPort` (51820).
 * WireGuard only speaks UDP on that port, so a TCP handshake there never
 * completes — it always timed out and returned null. edge-agent's HTTP
 * port (7999 by default) is what actually accepts a TCP connection, so
 * that's what we time here. A node with no agentUrl configured yet simply
 * can't be measured — that's correct, not a bug (see docs/DEPLOYMENT.md).
 *
 * In production, also run an equivalent measurement from the USER'S DEVICE
 * (via the mobile app) so "best server" reflects the player's actual path,
 * not just the backend's — this function only tells you how the backend
 * sees each node.
 */
function measureHttpRtt(agentUrl, timeoutMs = 1500) {
  return new Promise((resolve) => {
    if (!agentUrl) return resolve(null);

    let url;
    try {
      url = new URL("/health", agentUrl);
    } catch {
      return resolve(null);
    }

    const client = url.protocol === "https:" ? https : http;
    const start = process.hrtime.bigint();
    let settled = false;

    const finish = (ms) => {
      if (settled) return;
      settled = true;
      resolve(ms);
    };

    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      res.resume(); // drain, don't care about the body
      res.on("end", () => {
        const end = process.hrtime.bigint();
        finish(Number(end - start) / 1e6);
      });
    });

    req.on("timeout", () => {
      req.destroy();
      finish(null);
    });
    req.on("error", () => finish(null));
  });
}

async function refreshAllServerPings() {
  const servers = Servers.all();
  const results = await Promise.all(
    servers.map(async (s) => {
      const ms = await measureHttpRtt(s.agentUrl);
      const rounded = ms == null ? null : Math.round(ms);
      Servers.update(s.id, { lastPingMs: rounded, lastCheckedAt: new Date().toISOString() });
      pingLogs.push({ serverId: s.id, ms: rounded, at: Date.now() });
      return { ...s, lastPingMs: rounded };
    })
  );
  return results.sort((a, b) => (a.lastPingMs ?? 9999) - (b.lastPingMs ?? 9999));
}

function bestServerForGame(game) {
  const ranked = Servers.all()
    .filter((s) => s.lastPingMs != null)
    .sort((a, b) => a.lastPingMs - b.lastPingMs);

  if (!game) return ranked[0] || null;
  const preferred = ranked.filter((s) => game.bestRegions?.includes(s.name));
  return preferred[0] || ranked[0] || null;
}

module.exports = { measureHttpRtt, refreshAllServerPings, bestServerForGame };
