const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 4173;
const ROOT = __dirname;
const CONFIG_PATH = path.join(ROOT, 'config.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    const cfg = {
      adminPassword: 'dis-yas-2026',
      shareToken: crypto.randomBytes(8).toString('hex'),
      requireToken: false,
      stream: { videoId: '', title: '', live: false }
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
    return cfg;
  }
}

let config = loadConfig();
const saveConfig = () => fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

function extractVideoId(url) {
  const trimmed = String(url || '').trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  const patterns = [
    /youtube\.com\/watch\?.*v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/live\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/
  ];
  for (const p of patterns) {
    const m = trimmed.match(p);
    if (m) return m[1];
  }
  return null;
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function sendFile(res, file, status = 200) {
  fs.readFile(path.join(ROOT, 'public', file), (err, data) => {
    if (err) { res.writeHead(500); res.end('Erreur serveur'); return; }
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e5) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); } });
  });
}

const isAdmin = (req) => req.headers['x-admin-key'] === config.adminPassword;

const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;

  // ---- Static assets (logo, etc.) ----
  if (req.method === 'GET' && pathname.startsWith('/assets/')) {
    const publicDir = path.join(ROOT, 'public');
    const file = path.normalize(path.join(publicDir, pathname));
    if (!file.startsWith(publicDir + path.sep)) { res.writeHead(403); return res.end(); }
    return fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=86400' });
      res.end(data);
    });
  }

  // ---- Viewer ----
  // Accès ouvert pour l'instant ; passer requireToken à true dans config.json pour filtrer.
  const tokenRequired = config.requireToken === true;

  if (req.method === 'GET' && (pathname === '/' || pathname === '/live' || pathname.startsWith('/live/'))) {
    if (tokenRequired && pathname.split('/')[2] !== config.shareToken) {
      return sendFile(res, 'denied.html', 404);
    }
    return sendFile(res, 'watch.html');
  }

  if (req.method === 'GET' && pathname === '/api/stream') {
    if (tokenRequired && url.searchParams.get('token') !== config.shareToken) {
      return sendJSON(res, 403, { error: 'Lien invalide' });
    }
    const { videoId, title, live } = config.stream;
    return sendJSON(res, 200, { live, videoId: live ? videoId : null, title });
  }

  // ---- Admin ----
  if (req.method === 'GET' && pathname === '/admin') return sendFile(res, 'admin.html');

  if (req.method === 'POST' && pathname === '/api/admin/login') {
    const { password } = await readBody(req);
    return sendJSON(res, password === config.adminPassword ? 200 : 401,
      password === config.adminPassword ? { ok: true } : { error: 'Mot de passe incorrect' });
  }

  if (pathname.startsWith('/api/admin/') && pathname !== '/api/admin/login') {
    if (!isAdmin(req)) return sendJSON(res, 401, { error: 'Non autorisé' });

    if (req.method === 'GET' && pathname === '/api/admin/state') {
      return sendJSON(res, 200, { stream: config.stream, shareToken: config.shareToken });
    }
    if (req.method === 'POST' && pathname === '/api/admin/stream') {
      const body = await readBody(req);
      if (body.url !== undefined) {
        const id = extractVideoId(body.url);
        if (!id) return sendJSON(res, 400, { error: 'Lien YouTube non reconnu' });
        config.stream.videoId = id;
      }
      if (body.title !== undefined) config.stream.title = String(body.title).slice(0, 120);
      if (body.live !== undefined) config.stream.live = Boolean(body.live);
      if (config.stream.live && !config.stream.videoId) {
        config.stream.live = false;
        return sendJSON(res, 400, { error: 'Ajoutez d’abord un lien YouTube avant de passer en direct' });
      }
      saveConfig();
      return sendJSON(res, 200, { stream: config.stream });
    }
    if (req.method === 'POST' && pathname === '/api/admin/regenerate') {
      config.shareToken = crypto.randomBytes(8).toString('hex');
      saveConfig();
      return sendJSON(res, 200, { shareToken: config.shareToken });
    }
  }

  // Everything else: private access screen, no stream info leaked
  return sendFile(res, 'denied.html', 404);
});

server.listen(PORT, () => {
  console.log(`Yas Live sur http://localhost:${PORT}`);
  console.log(`Admin : http://localhost:${PORT}/admin`);
  console.log(`Lien privé : http://localhost:${PORT}/live/${config.shareToken}`);
});
