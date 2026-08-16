const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { v4: uuid } = require("uuid");
const { Users } = require("../config/db");

const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

async function createUser({ email, password, deviceId }) {
  const existing = Users.find((u) => u.email === email)[0];
  if (existing) throw new Error("Email already registered");

  const passwordHash = await bcrypt.hash(password, 10);
  const { token, expires } = makeVerifyToken();

  return Users.insert({
    id: uuid(),
    email,
    passwordHash,
    deviceId: deviceId || null,
    plan: "free",
    verified: false,
    verifyToken: token,
    verifyTokenExpires: expires,
    createdAt: new Date().toISOString(),
  });
}

function makeVerifyToken() {
  return {
    token: crypto.randomBytes(32).toString("hex"),
    expires: Date.now() + VERIFY_TOKEN_TTL_MS,
  };
}

async function verifyPassword(user, password) {
  // Google-only accounts have no passwordHash — never valid for /auth/login.
  if (!user.passwordHash) return false;
  return bcrypt.compare(password, user.passwordHash);
}

// Used by /auth/google. Google has already verified the email, so a
// brand-new account is created pre-verified and skips the token flow
// entirely; an existing email/password account just gets linked (so the
// person can sign in either way afterward) without touching its password.
function findOrCreateGoogleUser({ email, googleId }) {
  const existing = Users.find((u) => u.email === email)[0];
  if (existing) {
    if (!existing.googleId) return Users.update(existing.id, { googleId });
    return existing;
  }
  return Users.insert({
    id: uuid(),
    email,
    passwordHash: null,
    googleId,
    deviceId: null,
    plan: "free",
    verified: true,
    verifyToken: null,
    verifyTokenExpires: null,
    createdAt: new Date().toISOString(),
  });
}

function findByEmail(email) {
  return Users.find((u) => u.email === email)[0] || null;
}

function findById(id) {
  return Users.findById(id);
}

function findByVerifyToken(token) {
  return Users.find((u) => u.verifyToken === token)[0] || null;
}

// Marks the user verified and clears the token so it can't be replayed.
function markVerified(userId) {
  return Users.update(userId, { verified: true, verifyToken: null, verifyTokenExpires: null });
}

// Issues a fresh token (old one becomes invalid) — used for resend.
function reissueVerifyToken(userId) {
  const { token, expires } = makeVerifyToken();
  return Users.update(userId, { verifyToken: token, verifyTokenExpires: expires });
}

function toPublic(user) {
  const { passwordHash, verifyToken, verifyTokenExpires, ...safe } = user;
  return safe;
}

module.exports = {
  createUser,
  verifyPassword,
  findByEmail,
  findById,
  findByVerifyToken,
  findOrCreateGoogleUser,
  markVerified,
  reissueVerifyToken,
  toPublic,
};
