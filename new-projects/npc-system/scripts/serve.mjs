import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../public',import.meta.url));
const port=Number(process.env.PORT||4187);
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.md':'text/plain; charset=utf-8','.jar':'application/java-archive','.zip':'application/zip'};
http.createServer(async(req,res)=>{
 try{
  let rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(rel.endsWith('/'))rel+='index.html';
  const target=path.resolve(root,'.'+rel);
  if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  const content=await readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(content);
 }catch{res.writeHead(404).end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log('North Harbor: http://127.0.0.1:'+port+'/projects/npc-system/'));
