// ── publishPage.js — the page an admin publishes from ────────────────────────
//
// The display app opens /m/<CODE>/publish in a new tab. Cloudflare Access
// asks the admin to sign in there (on the Worker's own site, so it works in
// every browser, Safari included), then this page receives the settings
// from the app with postMessage — only from the origins in ALLOWED_ORIGINS
// — shows a short summary, and sends them to the Worker when the admin
// confirms. All text is set with textContent (no HTML from the settings).

const escapeAttr = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** The page, with the masjid code and the allowed app origins built in. */
export function publishHtml(code, allowedOrigins) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Publish settings — ${escapeAttr(code)}</title>
<style>
  body { font: 16px/1.5 system-ui, sans-serif; margin: 0; padding: 24px; background: #0b0b0b; color: #eee; }
  main { max-width: 560px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 4px; color: #c9a84c; }
  .muted { color: #9a8b6e; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin: 16px 0; }
  dt { color: #9a8b6e; }
  dd { margin: 0; overflow-wrap: anywhere; }
  button { font: inherit; padding: 10px 20px; margin: 8px 8px 0 0; border-radius: 4px; border: 1px solid #c9a84c; background: transparent; color: #c9a84c; cursor: pointer; }
  button.primary { background: #c9a84c; color: #111; }
  button:disabled { opacity: .5; cursor: default; }
  #status { margin-top: 16px; min-height: 1.5em; }
</style>
</head>
<body data-code="${escapeAttr(code)}" data-origins="${escapeAttr(JSON.stringify(allowedOrigins))}">
<main>
  <h1>Publish settings</h1>
  <div class="muted">Masjid code <strong id="code"></strong></div>
  <dl id="summary" hidden>
    <dt>Masjid</dt><dd id="s-name"></dd>
    <dt>Location</dt><dd id="s-loc"></dd>
    <dt>Jumu'ah</dt><dd id="s-jumuah"></dd>
    <dt>Announcements</dt><dd id="s-ann"></dd>
  </dl>
  <div id="status">Waiting for the settings from the display app…</div>
  <button id="publish" class="primary" disabled>Publish to all screens</button>
  <button id="cancel">Cancel</button>
</main>
<script src="/publish.js"></script>
</body>
</html>`;
}

/** The page's script (served from /publish.js; same origin, so script-src 'self'). */
export const PUBLISH_JS = `(function () {
  var body = document.body;
  var code = body.getAttribute('data-code');
  var allowed = [];
  try { allowed = JSON.parse(body.getAttribute('data-origins')) || []; } catch (e) {}
  var pending = null;
  var $ = function (id) { return document.getElementById(id); };
  var status = function (text) { $('status').textContent = text; };
  $('code').textContent = code;

  function summarise(s) {
    $('s-name').textContent = s.masjidName || '(no name)';
    $('s-loc').textContent = s.locName || '';
    var slots = Array.isArray(s.jumuah) ? s.jumuah.filter(function (j) { return j && j.enabled; }) : [];
    $('s-jumuah').textContent = slots.map(function (j) { return j.time; }).join(', ') || 'none';
    var lines = String(s.announcements || '').split('\\n').filter(function (l) { return l.trim(); });
    $('s-ann').textContent = lines.length + (lines.length === 1 ? ' line' : ' lines');
    $('summary').hidden = false;
  }

  window.addEventListener('message', function (event) {
    if (allowed.indexOf(event.origin) === -1) return;
    var data = event.data || {};
    if (data.type !== 'settings' || data.code !== code || !data.settings || typeof data.settings !== 'object') return;
    pending = { settings: data.settings, origin: event.origin };
    summarise(data.settings);
    status('Check the details, then publish. Every screen following ' + code + ' updates within seconds.');
    $('publish').disabled = false;
  });

  $('publish').addEventListener('click', function () {
    if (!pending) return;
    $('publish').disabled = true;
    status('Publishing…');
    fetch(location.pathname, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ settings: pending.settings })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (b) { return { ok: res.ok, body: b }; });
    }).then(function (r) {
      if (!r.ok) {
        status('Not published: ' + (r.body.error || 'the service refused it') + '.');
        $('publish').disabled = false;
        return;
      }
      status('Published (version ' + r.body.version + '). You can close this tab.');
      if (window.opener) window.opener.postMessage({ type: 'published', version: r.body.version }, pending.origin);
    }).catch(function () {
      status('Not published: no connection to the service. Try again.');
      $('publish').disabled = false;
    });
  });

  $('cancel').addEventListener('click', function () {
    if (window.opener && pending) window.opener.postMessage({ type: 'cancelled' }, pending.origin);
    window.close();
  });

  if (!allowed.length) status('Publishing is not set up: ALLOWED_ORIGINS is empty.');
  else if (window.opener) window.opener.postMessage({ type: 'ready' }, '*');
  else status('Open this page with the Publish button in the display app\\'s Settings.');
})();
`;
