const { execFile } = require("child_process");
const util = require("util");
const execFileAsync = util.promisify(execFile);

/**
 * Provisions WireGuard peer credentials for a session.
 *
 * Requires the `wireguard-tools` package installed on the backend host
 * (apt install wireguard-tools) so the real `wg genkey` / `wg pubkey`
 * binaries are available — this scaffold does not reimplement Curve25519
 * key generation itself.
 *
 * This only manages KEYS/CONFIG. It assumes each server in config/seed.js
 * is a real VPS you control, already running `wg-quick` with an interface
 * (see docs/DEPLOYMENT.md for the one-time server-side setup). The backend
 * still needs to call each edge node's local WireGuard API (or SSH) to add
 * the generated peer to that node's running interface — that step is
 * infra-specific and stubbed below as `registerPeerOnEdgeNode`.
 */

function getAgentSecret(serverName) {
  const raw = process.env.AGENT_SECRETS || "";
  for (const pair of raw.split(",")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const name = pair.slice(0, idx).trim();
    const secret = pair.slice(idx + 1).trim();
    if (name === serverName) return secret;
  }
  return null;
}

async function generateKeypair() {
  const { stdout: privateKey } = await execFileAsync("wg", ["genkey"]);
  const trimmedPrivateKey = privateKey.trim();

  const pubkeyCall = execFileAsync("wg", ["pubkey"]);
  pubkeyCall.child.stdin.write(trimmedPrivateKey + "\n");
  pubkeyCall.child.stdin.end();
  const { stdout: publicKey } = await pubkeyCall;

  return { privateKey: trimmedPrivateKey, publicKey: publicKey.trim() };
}

function buildClientConfig({ privateKey, clientAddress, serverPublicKey, serverEndpoint, serverPort, dns, includedApps }) {
  const lines = [
    "[Interface]",
    `PrivateKey = ${privateKey}`,
    `Address = ${clientAddress}`,
    `DNS = ${dns || "1.1.1.1"}`,
  ];

  // Per-app (split) tunneling: the WireGuard-for-Android library reads
  // this key straight out of the config text — no native-side config
  // rebuilding needed. Omit it entirely for a whole-device tunnel.
  //
  // IMPORTANT: the recognized key is exactly "IncludedApplications" (no
  // "Android" prefix) — com.wireguard.config.Interface.parse() switches on
  // a fixed set of key names, and anything outside that set throws
  // BadConfigException(UNKNOWN_ATTRIBUTE). "AndroidIncludedApplications"
  // was never a real key, which is what was breaking every connect().
  if (includedApps && includedApps.length) {
    lines.push(`IncludedApplications = ${includedApps.join(",")}`);
  }

  lines.push(
    "",
    "[Peer]",
    `PublicKey = ${serverPublicKey}`,
    `Endpoint = ${serverEndpoint}:${serverPort}`,
    "AllowedIPs = 0.0.0.0/0, ::/0",
    "PersistentKeepalive = 25"
  );

  return lines.join("\n");
}

/**
 * Calls the target edge node's agent (edge-agent/index.js, running on that
 * VPS) to actually add the WireGuard peer to its live interface. Requires
 * server.agentUrl to be set (see seed.js) and a matching secret in
 * AGENT_SECRETS — both only exist once you've deployed a real node.
 */
async function registerPeerOnEdgeNode(server, publicKey, clientAddress) {
  if (!server.agentUrl) {
    throw new Error(
      `${server.name} has no agentUrl configured yet — deploy edge-agent/ on that VPS and set ` +
        `agentUrl + publicKey in the server registry (see docs/DEPLOYMENT.md) before it can accept real connections.`
    );
  }

const secret = getAgentSecret(server.name);

  if (!secret) throw new Error(`No AGENT_SECRETS entry for ${server.name} in backend .env`);

const res = await fetchWithTimeout(`${server.agentUrl}/peers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Agent-Secret": secret },
    body: JSON.stringify({ publicKey, allowedIp: clientAddress.replace(/\/32$/, "/32") }),
  }).catch((e) => {
    throw new Error(`Couldn't reach ${server.name}'s edge-agent at ${server.agentUrl}: ${e.message}`);
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Edge node ${server.name} rejected peer registration: ${body.error || res.status}`);
  }
}

function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function removePeerFromEdgeNode(server, publicKey) {
  if (!server.agentUrl) return;
const secret = getAgentSecret(server.name);
  if (!secret) return;

  await fetch(`${server.agentUrl}/peers/${encodeURIComponent(publicKey)}`, {
    method: "DELETE",
    headers: { "X-Agent-Secret": secret },
  }).catch(() => {});
}

module.exports = { generateKeypair, buildClientConfig, registerPeerOnEdgeNode, removePeerFromEdgeNode };
