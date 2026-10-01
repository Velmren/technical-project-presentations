import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../web');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.md':'text/plain; charset=utf-8','.zip':'application/zip','.jar':'application/java-archive'};
http.createServer(async(req,res)=>{try{const request=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const p=path.resolve(root,'.'+(request==='/'?'/index.html':request));if(p!==root&&!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}const data=await fs.readFile(p);res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream','Cache-Control':'no-cache'}).end(data);}catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('Файл не найден');}}).listen(4193,'127.0.0.1',()=>console.log('Minecraft NPC System: http://127.0.0.1:4193'));
