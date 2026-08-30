const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { Servers, Sessions, pingLogs } = require("../config/db");

/**
 * Aggregates a data-usage summary for the profile screen, from real
 * per-user session data (see Sessions in tunnel.routes.js /connect and
 * /disconnect).
 *
 * totalMb now uses REAL measured bytes: ConnectionContext polls the
 * native WireGuard stats (getStats()) every ~8s while connected and posts
 * rxBytes/txBytes to /tunnel/report-stats, which are already stored per
 * session (see tunnel.routes.js). This just wasn't being summed here —
 * it fell back to a ~4MB/min guess instead. Sessions that have real byte
 * counts on file use those; only sessions with no reported bytes yet
 * (e.g. a very old session from before this fix, or a session that
 * disconnected before the first stats poll) fall back to the time
 * estimate, and the response is only flagged as an estimate overall if
 * that fallback was actually needed anywhere.
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

  // Real bytes: sum whatever each session actually reported. A session
  // only has rxBytes/txBytes once at least one report-stats call landed
  // for it — sessions with neither key present (undefined, not just 0)
  // haven't reported yet, so they fall back to the time estimate instead
  // of silently counting as 0 bytes used.
  let measuredBytes = 0;
  let estimateNeededMinutes = 0;
  for (const s of mySessions) {
    const hasRealBytes = s.rxBytes != null || s.txBytes != null;
    if (hasRealBytes) {
      measuredBytes += (s.rxBytes || 0) + (s.txBytes || 0);
    } else {
      const durationMin = (s.endedAt ? s.endedAt - s.startedAt : Date.now() - s.startedAt) / 60000;
      estimateNeededMinutes += durationMin;
    }
  }
  const measuredMb = measuredBytes / (1024 * 1024);
  const estimateMb = estimateNeededMinutes * 4; // ~4MB/min guess, only for sessions with no real report
  const totalMbIsEstimate = estimateNeededMinutes > 0 && measuredBytes === 0;

  res.json({
    totalMb: Math.round((measuredMb + estimateMb) * 10) / 10,
    totalMbIsEstimate,
    sessions: mySessions.length,
    avgSessionMin,
    longestSessionMin,
    lastConnectedAt: lastSession?.startedAt || null,
    avgPingMs: avgPingMs ?? 0,
    bestServer,
  });
});

module.exports = router;
