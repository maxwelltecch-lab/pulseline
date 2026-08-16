const router = require("express").Router();
const { v4: uuid } = require("uuid");
const { requireAuth } = require("../middleware/auth.middleware");

const feedback = []; // swap for a real table before production

router.post("/", requireAuth, (req, res) => {
  const { comment } = req.body;
  if (!comment || !comment.trim()) return res.status(400).json({ error: "Comment is required" });

  feedback.push({ id: uuid(), userId: req.userId, comment: comment.trim(), at: new Date().toISOString() });
  res.status(201).json({ ok: true });
});

module.exports = router;
