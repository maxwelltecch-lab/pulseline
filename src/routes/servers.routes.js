const router = require("express").Router();
const { Servers, Games } = require("../config/db");
const { refreshAllServerPings, bestServerForGame } = require("../services/pingService");
const { requireAuth } = require("../middleware/auth.middleware");

// Public: list known edge servers with their last-measured ping
router.get("/", (req, res) => {
  res.json({ servers: Servers.all() });
});

// Force a fresh latency sweep across all edge nodes
router.post("/refresh", requireAuth, async (req, res) => {
  const ranked = await refreshAllServerPings();
  res.json({ servers: ranked });
});

// Recommend the best server for a given game id (pubgm | efootball)
router.get("/best/:gameId", requireAuth, (req, res) => {
  const game = Games.findById(req.params.gameId) || Games.find((g) => g.id === req.params.gameId)[0];
  if (!game) return res.status(404).json({ error: "Unknown game" });

  const best = bestServerForGame(game);
  if (!best) return res.status(503).json({ error: "No ping data yet — call /servers/refresh first" });
  res.json({ game: game.id, recommended: best });
});

module.exports = router;
