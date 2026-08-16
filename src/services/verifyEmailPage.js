// Renders the page a user lands on after tapping the verification link in
// their email. Plain server-rendered HTML — no app/build step needed here,
// it just needs to look right in a mobile browser for a few seconds.
function renderVerifyPage({ ok, message }) {
  const icon = ok
    ? `<svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#00E676" stroke-width="2"><circle cx="12" cy="12" r="10" stroke="#00E676" stroke-opacity="0.35"/><path d="M8 12.5l2.5 2.5L16 9.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" stroke-width="2"><circle cx="12" cy="12" r="10" stroke="#FF6B6B" stroke-opacity="0.35"/><path d="M12 8v5" stroke-linecap="round"/><circle cx="12" cy="16" r="0.6" fill="#FF6B6B" stroke="none"/></svg>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${ok ? "Email verified" : "Verification failed"} — PulseLine</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #0A0E1A; color: #E8ECF4;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    padding: 24px;
  }
  .card {
    width: 100%; max-width: 360px; text-align: center;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 24px; padding: 36px 28px;
  }
  .icon { margin-bottom: 18px; }
  h1 { font-size: 19px; font-weight: 700; margin: 0 0 8px; }
  p { font-size: 13px; line-height: 19px; color: #7B8496; margin: 0 0 22px; }
  .brand { font-size: 11px; letter-spacing: 1.5px; color: #00E5FF; margin-bottom: 22px; font-weight: 600; }
  .hint { font-size: 11px; color: #7B8496; }
</style>
</head>
<body>
  <div class="card">
    <div class="brand">PULSELINE</div>
    <div class="icon">${icon}</div>
    <h1>${ok ? "Email verified" : "Link expired or invalid"}</h1>
    <p>${message}</p>
    <div class="hint">${ok ? "You can close this tab and return to the app." : "Open PulseLine and request a new link from your profile."}</div>
  </div>
</body>
</html>`;
}

module.exports = { renderVerifyPage };
