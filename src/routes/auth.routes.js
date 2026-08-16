const router = require("express").Router();
const {
  createUser,
  verifyPassword,
  findByEmail,
  findById,
  findByVerifyToken,
  markVerified,
  reissueVerifyToken,
  toPublic,
} = require("../models/User");
const { signToken } = require("../middleware/auth.middleware");
const { sendVerificationEmail } = require("../services/emailService");

router.post("/register", async (req, res) => {
  try {
    const { email, password, deviceId } = req.body;
    if (!email || !password) return res.status(400).json({ error: "email and password are required" });

    const user = await createUser({ email, password, deviceId });
    sendVerificationEmail(user, user.verifyToken).catch((err) =>
      console.error("[auth] failed to send verification email:", err.message)
    );

    const token = signToken(user.id);
    res.status(201).json({ token, user: toPublic(user) });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = findByEmail(email);
  if (!user || !(await verifyPassword(user, password))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const token = signToken(user.id);
  res.json({ token, user: toPublic(user) });
});

// Hit directly from the link in the verification email — no auth header
// available at that point, so the token itself is the credential.
router.get("/verify-email/:token", (req, res) => {
  const user = findByVerifyToken(req.params.token);
  if (!user || !user.verifyTokenExpires || user.verifyTokenExpires < Date.now()) {
    return res.status(400).send("This verification link is invalid or has expired. Request a new one from the app.");
  }
  markVerified(user.id);
  res.send("Email verified — you can go back to PulseLine now.");
});

// Requires auth so we know which user to resend for.
router.post("/resend-verification", require("../middleware/auth.middleware").requireAuth, async (req, res) => {
  const user = findById(req.userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.verified) return res.json({ alreadyVerified: true });

  const updated = reissueVerifyToken(user.id);
  await sendVerificationEmail(updated, updated.verifyToken);
  res.json({ sent: true });
});

module.exports = router;
