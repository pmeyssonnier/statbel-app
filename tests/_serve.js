/*
 * Petit serveur de fichiers statiques pour les tests headless.
 *
 * `index.html` charge désormais `js/app.js` comme module ES (`<script
 * type="module">`). Or les navigateurs refusent les modules servis en
 * `file://` (politique CORS) : les tests doivent donc passer par http(s).
 * Ce serveur sert la racine du dépôt sur un port éphémère, au plus proche
 * des conditions réelles (l'app est de toute façon servie via Pages/PWA).
 *
 * Usage :
 *   const { serve } = require('./_serve');
 *   const srv = await serve();               // { url, close }
 *   await page.goto(srv.url + '/index.html');
 *   ...
 *   await srv.close();
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

function serve() {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel === '/' ) rel = '/index.html';
    // empêche toute sortie de la racine (../)
    const abs = path.normalize(path.join(ROOT, rel));
    if (!abs.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
    fs.readFile(abs, (err, buf) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: 'http://127.0.0.1:' + port,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

module.exports = { serve };
