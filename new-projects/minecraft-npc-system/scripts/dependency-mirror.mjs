// Loopback transport for the server's standard Maven Central mirror.
import http from 'node:http';
import https from 'node:https';
http.createServer((req,res)=>{
  if(!req.url.startsWith('/maven2/')){res.writeHead(404);res.end();return;}
  const upstream=https.get('https://maven-central.storage-download.googleapis.com'+req.url,r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});
  upstream.on('error',e=>{res.writeHead(502);res.end(String(e));});
}).listen(25597,'127.0.0.1',()=>console.log('LOCAL_DEPENDENCY_MIRROR 25597'));
