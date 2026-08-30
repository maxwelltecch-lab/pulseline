const { v4: uuid } = require("uuid");
const { Servers, Games } = require("./db");

// Add publicKey + agentUrl once you've actually deployed a node (see
// docs/DEPLOYMENT.md) — leave them as null for nodes you haven't set up
// yet. wireguardPort defaults to 51820 if omitted.
//
// IMPORTANT (real-ping fix): agentUrl must be reachable DIRECTLY FROM THE
// PHONE now, not just from this backend — the app times its own request
// to `${agentUrl}/ping` to show real latency (see
// ConnectionContext.measureDeviceRtt). The two entries below still point
// at 127.0.0.1, which only resolves to "the backend server itself" — a
// phone can never reach that and will show "--" for ms on those servers.
// Point agentUrl at the node's actual LAN/public IP (same as `host`,
// unless the agent listens on a different port) before testing on a
// real device.
const EDGE_NODES = [
  { name: "Nairobi", country: "Kenya", region: "AF", host: "192.168.8.104", publicKey: "AtPbZj5+gV3xBvC8J5eIJ+8kUILQefyk1kX2/CuVzyY=",  agentUrl: "http://127.0.0.1:7999" },
  { name: "Singapore", country: "Singapore", region: "APAC", host: "103.xxx.xxx.xxx", publicKey: null, agentUrl: null },
  { name: "Mumbai", country: "India", region: "APAC", host: "192.168.8.104", publicKey: "AtPbZj5+gV3xBvC8J5eIJ+8kUILQefyk1kX2/CuVzyY=", agentUrl: "http://127.0.0.1:7999" },
  { name: "Frankfurt", country: "Germany", region: "EU", host: "88.xxx.xxx.xxx", publicKey: null, agentUrl: null },
  { name: "Cape Town", country: "South Africa", region: "AF", host: "196.xxx.xxx.xxx", publicKey: null, agentUrl: null },
];

const GAMES = [
  { id: "pubgm", name: "PUBG Mobile", packageAndroid: "com.tencent.ig", bestRegions: ["Singapore", "Mumbai"] },
  { id: "efootball", name: "eFootball", packageAndroid: "jp.konami.pesam", bestRegions: ["Frankfurt", "Nairobi"] },
];

function seed() {
  EDGE_NODES.forEach((n) =>
    Servers.insert({
      id: uuid(),
      name: n.name,
      country: n.country,
      region: n.region,
      host: n.host,
      wireguardPort: n.wireguardPort || 51820,
      publicKey: n.publicKey || null,
      agentUrl: n.agentUrl || null,
      loadPct: Math.round(15 + Math.random() * 30),
      lastPingMs: null,
      lastCheckedAt: null,
    })
  );
  GAMES.forEach((g) => Games.insert(g));
  console.log(`Seeded ${EDGE_NODES.length} edge servers and ${GAMES.length} games.`);
}

if (require.main === module) seed();

module.exports = { seed };
