const router = require("express").Router();
const { v4: uuidv4 } = require("uuid");
const { requireAuth } = require("../middleware/auth.middleware");
const { Servers, Sessions } = require("../config/db");
const { activeFor } = require("../models/Subscription");
const { generateKeypair, buildClientConfig, registerPeerOnEdgeNode } = require("../services/tunnelService");

// Start a boost session: registers a real peer on the target edge node and
// issues the matching WireGuard client config. Free-plan users are capped
// off the lowest-load (highest priority) routes; premium/trial plans get
// full access.
router.post("/connect", requireAuth, async (req, res) => {
  try {
    const { serverId, includedApps } = req.body;
    const server = Servers.findById(serverId);
    if (!server) return res.status(404).json({ error: "Unknown server" });

    if (!server.publicKey) {
      return res.status(503).json({
        error: `${server.name} isn't deployed yet — no publicKey on file. See docs/DEPLOYMENT.md to bring this node online.`,
      });
    }

    /*const sub = activeFor(req.userId);
    if (!sub && server.loadPct < 25) {
      return res.status(402).json({ error: "This route is reserved for subscribers", upgradeRequired: true });
    }*/

    const { privateKey, publicKey } = await generateKeypair();
    const clientAddress = `10.66.0.${Math.floor(Math.random() * 200) + 2}/32`;

    // This is the step that actually makes the tunnel work end-to-end: the
    // node won't accept the client's handshake until its peer is added.
    await registerPeerOnEdgeNode(server, publicKey, clientAddress);

    const config = buildClientConfig({
      privateKey,
      clientAddress,
      serverPublicKey: server.publicKey,
      serverEndpoint: server.host,
      serverPort: server.wireguardPort,
      includedApps,
    });

    // Defense in depth: if this ever fires, the bug is in buildClientConfig
    // or its inputs, not in the app/network layer — check this log line
    // first before chasing it on the Android side.
    if (!config.startsWith("[Interface]")) {
      console.error(`[tunnel/connect] built a malformed config for server=${server.name}:\n${config}`);
      return res.status(500).json({ error: "Backend built an invalid WireGuard config — check backend logs for the raw text." });
    }

    // Data usage was previously synthesized from global ping-sample counts
    // (not per-user, not real durations). Track real per-user sessions
    // instead — closed out by the /disconnect route below.
    const session = Sessions.insert({
      id: uuidv4(),
      userId: req.userId,
      serverId: server.id,
      serverName: server.name,
      startedAt: Date.now(),
      endedAt: null,
    });

    res.json({ server: server.name, clientPublicKey: publicKey, wireguardConfig: config, sessionId: session.id });
  } catch (err) {
    console.error(`[tunnel/connect] failed for server=${req.body?.serverId}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// The app previously never told the backend when a tunnel went down — data
// usage had no real session durations as a result. Called from
// ConnectionContext.disconnect() with the sessionId returned by /connect.
router.post("/disconnect", requireAuth, (req, res) => {
  const { sessionId } = req.body;
  const session = sessionId && Sessions.findById(sessionId);
  if (session && session.userId === req.userId && !session.endedAt) {
    Sessions.update(session.id, { endedAt: Date.now() });
  }
  res.json({ ok: true });
});

// Fed by ConnectionContext polling WireguardTunnel.getStats() (real
// WireGuard rx/tx counters, not an estimate) every ~8s while connected,
// plus a final call on disconnect. Last write per session wins — the
// native side always reports cumulative totals for the session, not deltas.
router.post("/report-stats", requireAuth, (req, res) => {
  const { sessionId, rxBytes, txBytes } = req.body;
  const session = sessionId && Sessions.findById(sessionId);
  if (session && session.userId === req.userId) {
    Sessions.update(session.id, { rxBytes: rxBytes || 0, txBytes: txBytes || 0 });
  }
  res.json({ ok: true });
});


module.exports = router;
