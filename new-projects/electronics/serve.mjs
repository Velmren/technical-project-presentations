import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../public/projects/electronics/', import.meta.url));
const port = Number(process.env.PORT || 5196);
const base = '/projects/electronics/';
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if(pathname === '/') { res.writeHead(302,{Location:base}); res.end(); return; }
    if(!pathname.startsWith(base)) { res.writeHead(404); res.end('Not found'); return; }
    const requested = pathname.slice(base.length) || 'index.html';
    const file = resolve(root,requested);
    if(!file.startsWith(resolve(root)+sep)) { res.writeHead(403); res.end('Forbidden'); return; }
    if(!(await stat(file)).isFile()) throw new Error('Not a file');
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(await readFile(file));
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`SONO static demo: http://127.0.0.1:${port}${base}`));

