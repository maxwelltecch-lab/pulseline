require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server: SocketServer } = require("socket.io");

const authRoutes = require("./routes/auth.routes");
const serverRoutes = require("./routes/servers.routes");
const gameRoutes = require("./routes/games.routes");
const tunnelRoutes = require("./routes/tunnel.routes");
const subscriptionRoutes = require("./routes/subscriptions.routes");
const paymentRoutes = require("./routes/payments.routes");
const feedbackRoutes = require("./routes/feedback.routes");
const telemetryRoutes = require("./routes/telemetry.routes");
const { attachTelemetry } = require("./sockets/telemetry.socket");
const { seed } = require("./config/seed");

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

app.use((req, res, next) => {
const start = Date.now();
res.on("finish", () => {
console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
}); next();});

app.get("/health", (req, res) => res.json({ ok: true, service: "pulseline-backend" }));

app.use("/auth", authRoutes);
app.use("/servers", serverRoutes);
app.use("/games", gameRoutes);
app.use("/tunnel", tunnelRoutes);
app.use("/subscriptions", subscriptionRoutes);
app.use("/payments", paymentRoutes);
app.use("/feedback", feedbackRoutes);
app.use("/telemetry", telemetryRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const httpServer = http.createServer(app);
const io = new SocketServer(httpServer, { cors: { origin: process.env.CORS_ORIGIN || "*" } });
attachTelemetry(io);

// Seed demo edge servers + games on boot (in-memory store — see config/db.js)
seed();

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`PulseLine backend listening on :${PORT}`);
});
