const jwt = require("jsonwebtoken");
const { Servers } = require("../config/db");
const { measureHttpRtt } = require("../services/pingService");

/**
 * Streams live latency samples to a connected client for whichever server
 * it's currently boosted through, so the app's oscilloscope graph reflects
 * real measured RTT instead of placeholder animation.
 */
function attachTelemetry(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.sub;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    let interval = null;

    socket.on("subscribe", ({ serverId }) => {
      clearInterval(interval);
      const server = Servers.findById(serverId);
      if (!server) return socket.emit("error", "unknown server");

      interval = setInterval(async () => {
        const ms = await measureHttpRtt(server.agentUrl);
        socket.emit("ping-sample", { serverId, ms: ms == null ? null : Math.round(ms), at: Date.now() });
      }, 1000);
    });

    socket.on("disconnect", () => clearInterval(interval));
  });
}

module.exports = { attachTelemetry };
