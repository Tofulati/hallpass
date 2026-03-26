#!/usr/bin/env node
/**
 * Local web UI for catalog scraping + Firestore push.
 *
 *   npm run catalog:ui
 *
 * Then open http://127.0.0.1:8790
 *
 * Set GOOGLE_APPLICATION_CREDENTIALS in the form (or in your shell) before Push to database.
 */

import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CONFIG_PATH = join(ROOT, 'scripts/scraper-config.json');
const DEFAULTS_PATH = join(ROOT, 'scripts/catalog-defaults.json');
const SCRAPE_SCRIPT = join(ROOT, 'scripts/scrape-catalog.mjs');
const PUSH_SCRIPT = join(ROOT, 'scripts/catalog-push.mjs');
const PORT = Number(process.env.CATALOG_ADMIN_PORT || 8790);

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>HallPass — Catalog admin</title>
  <style>
    :root {
      --bg: #0f1419;
      --surface: #1a2332;
      --border: #2d3a4d;
      --text: #e7edf4;
      --muted: #8b9cb3;
      --accent: #5b8def;
      --ok: #3ecf8e;
      --err: #f87171;
    }
    * { box-sizing: border-box; }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      line-height: 1.5;
      min-height: 100vh;
    }
    .wrap { max-width: 960px; margin: 0 auto; padding: 1.5rem; }
    h1 { font-size: 1.35rem; font-weight: 600; margin: 0 0 0.25rem; }
    .sub { color: var(--muted); font-size: 0.9rem; margin-bottom: 1.25rem; }
    section {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1rem 1.1rem;
      margin-bottom: 1rem;
    }
    h2 { font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin: 0 0 0.65rem; }
    textarea {
      width: 100%;
      min-height: 280px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
      font-size: 12px;
      background: #0d1117;
      color: #c9d1d9;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.75rem;
      resize: vertical;
    }
    input[type="text"] {
      width: 100%;
      max-width: 100%;
      background: #0d1117;
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.5rem 0.65rem;
      font-size: 13px;
    }
    label { display: block; font-size: 0.8rem; color: var(--muted); margin-bottom: 0.35rem; }
    .row { margin-bottom: 0.85rem; }
    .btns { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; }
    button {
      cursor: pointer;
      border: none;
      border-radius: 8px;
      padding: 0.5rem 1rem;
      font-size: 13px;
      font-weight: 500;
    }
    .primary { background: var(--accent); color: #fff; }
    .secondary { background: var(--border); color: var(--text); }
    .success { background: #1a4d3a; color: var(--ok); }
    #log {
      white-space: pre-wrap;
      font-family: ui-monospace, monospace;
      font-size: 11px;
      background: #0d1117;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.75rem;
      min-height: 120px;
      max-height: 280px;
      overflow: auto;
      color: #a7c7ff;
    }
    .msg { margin-top: 0.5rem; font-size: 13px; }
    .msg.ok { color: var(--ok); }
    .msg.err { color: var(--err); }
    ul.hint { margin: 0.4rem 0 0; padding-left: 1.2rem; color: var(--muted); font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Catalog admin</h1>
    <p class="sub">Edit scraper config → run scrape (updates local JSON) → push to Firestore (fill-missing only; does not wipe existing fields).</p>

    <section>
      <h2>Scraper configuration</h2>
      <p class="sub" style="margin-bottom:0.75rem">Toggle <code>sections</code> and list schools under <code>universities</code>. Use <code>sources</code> for HTML targets when scraping courses/orgs/professors.</p>
      <textarea id="config" spellcheck="false"></textarea>
      <div class="btns">
        <button type="button" class="secondary" id="btnLoad">Reload from disk</button>
        <button type="button" class="primary" id="btnSave">Save config</button>
        <button type="button" class="secondary" id="btnValidate">Validate JSON</button>
      </div>
      <p id="cfgMsg" class="msg" role="status"></p>
    </section>

    <section>
      <h2>Service account (for Firestore only)</h2>
      <div class="row">
        <label for="creds">Path to Firebase service account JSON</label>
        <input type="text" id="creds" placeholder="/path/to/serviceAccount.json" autocomplete="off" />
      </div>
      <p class="sub" style="margin:0">If empty, the server uses <code>GOOGLE_APPLICATION_CREDENTIALS</code> from the environment.</p>
    </section>

    <section>
      <h2>Run</h2>
      <div class="btns">
        <button type="button" class="primary" id="btnScrape">Scrape → replace catalog JSON</button>
        <button type="button" class="secondary" id="btnScrapeMerge">Scrape → merge with existing JSON</button>
        <button type="button" class="success" id="btnPush">Push catalog → Firestore</button>
        <button type="button" class="secondary" id="btnPushDry">Push dry-run</button>
      </div>
      <ul class="hint">
        <li>Output file: <code>scripts/onboarding-catalog.json</code> (from <code>outputPath</code> in config)</li>
        <li>By default each scrape <strong>replaces</strong> the catalog (only data from this run; disabled sections become empty arrays). Use the merge button, <code>--merge</code>, or <code>"mergeExisting": true</code> in config to keep previous file data.</li>
        <li>Push only fills empty fields on existing docs; new docs still get full records.</li>
      </ul>
      <h2 style="margin-top:1rem">Log</h2>
      <div id="log"></div>
    </section>
  </div>
  <script>
    const configEl = document.getElementById('config');
    const credsEl = document.getElementById('creds');
    const logEl = document.getElementById('log');
    const cfgMsg = document.getElementById('cfgMsg');

    function log(line) {
      logEl.textContent += line + String.fromCharCode(10);
      logEl.scrollTop = logEl.scrollHeight;
    }
    function setCfgMsg(text, ok) {
      cfgMsg.textContent = text;
      cfgMsg.className = 'msg ' + (ok ? 'ok' : 'err');
    }

    async function loadConfig() {
      const r = await fetch('/api/config');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      configEl.value = JSON.stringify(j.config, null, 2);
      setCfgMsg('Loaded.', true);
    }

    document.getElementById('btnLoad').onclick = () => loadConfig().catch(e => setCfgMsg(e.message, false));
    document.getElementById('btnValidate').onclick = () => {
      try {
        JSON.parse(configEl.value || '{}');
        setCfgMsg('JSON is valid.', true);
      } catch (e) {
        setCfgMsg(e.message, false);
      }
    };
    document.getElementById('btnSave').onclick = async () => {
      try {
        const body = JSON.parse(configEl.value || '{}');
        const r = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Save failed');
        setCfgMsg('Saved scraper-config.json', true);
      } catch (e) {
        setCfgMsg(e.message, false);
      }
    };

    function runCmd(path, extraEnv, scrapeMerge) {
      logEl.textContent = '';
      log('Starting…');
      fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: path,
          credentialsPath: credsEl.value.trim() || undefined,
          extraEnv,
          scrapeMerge: !!scrapeMerge,
        })
      })
        .then(r => r.json().then(j => ({ r, j })))
        .then(({ r, j }) => {
          if (j.stdout) log(j.stdout);
          if (j.stderr) log(j.stderr);
          if (!r.ok) log('Exit ' + j.code + (j.error ? ': ' + j.error : ''));
          else log('Done (exit 0).');
        })
        .catch(e => log('Error: ' + e.message));
    }

    document.getElementById('btnScrape').onclick = () => runCmd('scrape');
    document.getElementById('btnScrapeMerge').onclick = () => runCmd('scrape', undefined, true);
    document.getElementById('btnPush').onclick = () => runCmd('push');
    document.getElementById('btnPushDry').onclick = () => runCmd('push', { dryRun: true });

    try {
      credsEl.value = localStorage.getItem('hallpass_gcp_creds') || '';
    } catch (_) {}
    credsEl.addEventListener('change', () => {
      try { localStorage.setItem('hallpass_gcp_creds', credsEl.value.trim()); } catch (_) {}
    });

    loadConfig().catch(e => {
      cfgMsg.textContent = e.message;
      cfgMsg.className = 'msg err';
    });
  </script>
</body>
</html>`;

function runNodeScript(scriptPath, args, extraEnv = {}) {
  return new Promise((resolvePromise) => {
    const env = { ...process.env, ...extraEnv };
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: ROOT,
      env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('close', (code) => {
      resolvePromise({ code, stdout, stderr });
    });
  });
}

async function readConfigOrDefaults() {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    const raw = await readFile(DEFAULTS_PATH, 'utf8');
    return JSON.parse(raw);
  }
}

async function resolveCatalogPathFromConfig() {
  const cfg = await readConfigOrDefaults();
  const rel = cfg.outputPath || 'scripts/onboarding-catalog.json';
  return resolve(ROOT, rel);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/config') {
    try {
      const config = await readConfigOrDefaults();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ config }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/config') {
    let body = '';
    for await (const ch of req) body += ch;
    try {
      const parsed = JSON.parse(body || '{}');
      await writeFile(CONFIG_PATH, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/run') {
    let body = '';
    for await (const ch of req) body += ch;
    let payload = {};
    try {
      payload = JSON.parse(body || '{}');
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON body', code: 1 }));
      return;
    }

    const extraEnv = {};
    if (payload.credentialsPath) {
      extraEnv.GOOGLE_APPLICATION_CREDENTIALS = payload.credentialsPath;
    }

    let result;
    if (payload.script === 'scrape') {
      const scrapeArgs = ['--config', CONFIG_PATH];
      if (payload.scrapeMerge) scrapeArgs.push('--merge');
      result = await runNodeScript(SCRAPE_SCRIPT, scrapeArgs, extraEnv);
    } else if (payload.script === 'push') {
      const catalogFile = await resolveCatalogPathFromConfig();
      const args = ['--catalog', catalogFile];
      if (payload.extraEnv?.dryRun) args.push('--dry-run');
      result = await runNodeScript(PUSH_SCRIPT, args, extraEnv);
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unknown script', code: 1 }));
      return;
    }

    const status = result.code === 0 ? 200 : 500;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        code: result.code,
        stdout: result.stdout,
        stderr: result.stderr,
      }),
    );
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Catalog admin  http://127.0.0.1:${PORT}`);
});
