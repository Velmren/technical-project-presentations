// Local preview. The page lives at /projects/assembly/ and its frames at /assets/assembly/,
// the same paths as on the site, so the relative links in the markup work unchanged.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const assets = path.resolve(root, '../../public/assets');
const port = Number(process.env.PORT || 4361);
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.mp4': 'video/mp4', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

http.createServer((req, res) => {
  let name;
  try {
    name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (name === '/') {
    res.writeHead(302, {Location: '/projects/assembly/'}).end();
    return;
  }
  let base;
  let rel;
  if (name.startsWith('/projects/assembly/')) {
    base = root;
    rel = name.slice('/projects/assembly/'.length) || 'index.html';
  } else if (name.startsWith('/assets/')) {
    base = assets;
    rel = name.slice('/assets/'.length);
  } else {
    res.writeHead(404).end('Not found');
    return;
  }
  const file = path.resolve(base, rel);
  if (!file.startsWith(base + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache'}).end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`Veresta: http://127.0.0.1:${port}/projects/assembly/`));
