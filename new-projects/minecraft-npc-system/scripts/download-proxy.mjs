// Standard local forward proxy for developer tools whose own remote socket route is unavailable.
import http from 'node:http';import net from 'node:net';
const proxy=http.createServer((req,res)=>{const u=new URL(req.url);const p=http.request(u,{method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});p.on('error',e=>{res.writeHead(502);res.end(String(e));});req.pipe(p);});
proxy.on('connect',(req,client,head)=>{const [host,port]=req.url.split(':');const remote=net.connect(Number(port)||443,host,()=>{client.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)remote.write(head);remote.pipe(client);client.pipe(remote);});remote.on('error',()=>client.destroy());client.on('error',()=>remote.destroy());});
proxy.listen(25598,'127.0.0.1',()=>console.log('Dev forward proxy127.0.0.1:25598'));
