// Isolated loopback development controller. Never copy this to a public server.
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdirSync,appendFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const server=process.argv[2]??'paper',jar=process.argv[3]??server+'.jar',control=Number(process.argv[4]??25589);
const root=resolve(import.meta.dirname,'..'),cwd=root+'/.runtime/'+server;
mkdirSync(root+'/build/verification',{recursive:true});const logFile=root+'/build/verification/'+server+'-runtime.log';writeFileSync(logFile,'');
const java=process.env.NPC_TEST_JAVA??'java';
const proc=spawn(java,['-Xms256M','-Xmx1536M','-Dterminal.jline=false','-Dterminal.ansi=false','-jar',jar,'--nogui'],{cwd,windowsHide:true,stdio:['pipe','pipe','pipe']});
let log='',ready=false;
function consume(b){const s=b.toString();log+=s;appendFileSync(logFile,s);if(s.includes('Done (')){ready=true;console.log('SERVER_READY '+server);}for(const line of s.split('\n'))if(/MinecraftNPC|NPC_VERIFY|ERROR|SEVERE/.test(line)&&line.length<500)console.log(line.trim());}
proc.stdout.on('data',consume);proc.stderr.on('data',consume);proc.on('error',e=>console.error(e));
const api=createServer(async(req,res)=>{res.setHeader('content-type','application/json');if(req.method==='GET'){res.end(JSON.stringify({ready,pid:proc.pid,tail:log.slice(-12000)}));return;}let b='';for await(const c of req)b+=c;try{const {command}=JSON.parse(b);if(typeof command!=='string'||command.includes('\n'))throw Error('One console command expected');proc.stdin.write(command+'\n');res.end(JSON.stringify({ok:true}));}catch(e){res.statusCode=400;res.end(JSON.stringify({error:String(e)}));}}).listen(control,'127.0.0.1',()=>console.log('LOCAL_CONTROL http://127.0.0.1:'+control));
proc.on('exit',code=>{console.log('SERVER_EXIT',code);api.close();process.exitCode=code??1;});
process.on('SIGINT',()=>proc.stdin.write('stop\n'));process.on('SIGTERM',()=>proc.stdin.write('stop\n'));
