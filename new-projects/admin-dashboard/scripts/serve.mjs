import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../../../public/projects/admin-dashboard/',import.meta.url)));
const mount='/projects/admin-dashboard/';
const args=process.argv.slice(2);const port=Number(args[args.indexOf('--port')+1])||5190;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{try{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(pathname==='/'||pathname==='/projects/admin-dashboard'){res.writeHead(302,{Location:mount});res.end();return}
 if(!pathname.startsWith(mount)){res.writeHead(404);res.end('Not found');return}
 let file=resolve(root,pathname.slice(mount.length)||'index.html');
 if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end('Forbidden');return}
 if((await stat(file)).isDirectory())file=resolve(file,'index.html');
 const extension=file.slice(file.lastIndexOf('.'));
 const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[extension]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
 }catch{res.writeHead(404);res.end('Not found')}});
server.listen(port,'127.0.0.1',()=>console.log(`ORBIT static preview: http://127.0.0.1:${port}${mount}`));

