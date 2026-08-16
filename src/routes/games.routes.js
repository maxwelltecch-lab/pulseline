const router = require("express").Router();
const { Games } = require("../config/db");

router.get("/", (req, res) => {
  res.json({ games: Games.all() });
});

module.exports = router;
