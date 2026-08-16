const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { Servers, Sessions, pingLogs } = require("../config/db");

/**
 * Aggregates a data-usage summary for the profile screen, from real
 * per-user session data (see Sessions in tunnel.routes.js /connect and
 * /disconnect).
 *
 * totalMb is still an estimate, not measured bytes — real byte accounting
 * needs the WireGuard edge nodes to report `wg show wg0 transfer` per peer
 * back to this backend, since that's the only place actual tunnel traffic
 * is visible. Sessions/duration/best-server below ARE real, tracked
 * per-user data now, not global placeholders.
 */
router.get("/data-usage", requireAuth, (req, res) => {
  const mySessions = Sessions.find((s) => s.userId === req.userId);
  const closedSessions = mySessions.filter((s) => s.endedAt);
  const openSession = mySessions.find((s) => !s.endedAt);

  const durationsMin = closedSessions.map((s) => (s.endedAt - s.startedAt) / 60000);
  // A currently-connected session has no endedAt yet — count its elapsed
  // time so far too, or totalMb/longestSessionMin sit at 0 while you're
  // actively tunneling and only update after you disconnect.
  const openMin = openSession ? (Date.now() - openSession.startedAt) / 60000 : 0;
  const allDurationsMin = openSession ? [...durationsMin, openMin] : durationsMin;

  const avgSessionMin = durationsMin.length
    ? Math.round((durationsMin.reduce((a, d) => a + d, 0) / durationsMin.length) * 10) / 10
    : 0;
  const longestSessionMin = allDurationsMin.length ? Math.round(Math.max(...allDurationsMin) * 10) / 10 : 0;
  const totalMinutes = allDurationsMin.reduce((a, d) => a + d, 0);

  const serverCounts = {};
  for (const s of mySessions) serverCounts[s.serverName] = (serverCounts[s.serverName] || 0) + 1;
  const bestServer = Object.entries(serverCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  const lastSession = mySessions.slice().sort((a, b) => b.startedAt - a.startedAt)[0];

  // Network-wide average ping across monitored servers (background health
  // checks — see services/pingService.js), not specific to this user's
  // sessions. Shown as general network health context, not personal usage.
  const samples = pingLogs.filter((p) => p.ms != null);
  const avgPingMs = samples.length ? Math.round(samples.reduce((a, s) => a + s.ms, 0) / samples.length) : null;

  res.json({
    totalMb: Math.round(totalMinutes * 4), // estimate: ~4MB/min tunneled — replace with real wg transfer stats
    totalMbIsEstimate: true,
    sessions: mySessions.length,
    avgSessionMin,
    longestSessionMin,
    lastConnectedAt: lastSession?.startedAt || null,
    avgPingMs: avgPingMs ?? 0,
    bestServer,
  });
});

module.exports = router;
