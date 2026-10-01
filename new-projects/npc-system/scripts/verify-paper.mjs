import {spawn} from 'node:child_process';
import {writeFileSync,mkdirSync,readFileSync,existsSync,renameSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),server=root+'.server/';
const logs=root+'build/verification/';mkdirSync(logs,{recursive:true});
const props=server+'server.properties';
let s=readFileSync(props,'utf8').replace(/^server-ip=.*$/m,'server-ip=127.0.0.1').replace(/^pause-when-empty-seconds=.*$/m,'pause-when-empty-seconds=-1');
writeFileSync(props,s);
// Preserve old prototype artifact without loading it into this verification server.
const old=server+'plugins/beacon-guide-1.0.0.jar';
if(existsSync(old))renameSync(old,root+'legacy/beacon-guide-1.0.0.jar');
for(let phase=1;phase<=3;phase++){
 await new Promise((resolve,reject)=>{
  const p=spawn('java',['-Xms256M','-Xmx768M','-Dharbor.verify.phase='+phase,'-jar','paper.jar','--nogui'],{cwd:server,windowsHide:true,stdio:['pipe','pipe','pipe']});
  let log='',passed=false,failed=false;
  const timeout=setTimeout(()=>{failed=true;p.stdin.write('stop\n');setTimeout(()=>p.kill(),10000);},150000);
  const consume=data=>{const text=data.toString();log+=text;if(text.includes('HARBOR_VERIFY_FAIL')){failed=true;p.stdin.write('stop\n');}
   if(text.includes('HARBOR_VERIFY_PASS_PHASE'+phase)){passed=true;console.log(text.trim());p.stdin.write('stop\n');}};
  p.stdout.on('data',consume);p.stderr.on('data',consume);p.on('error',reject);
  p.on('exit',code=>{clearTimeout(timeout);writeFileSync(logs+'paper-phase-'+phase+'.log',log);if(passed&&!failed&&code===0)resolve();else reject(new Error('Paper phase '+phase+' failed, inspect '+logs+'paper-phase-'+phase+'.log'));});
 });
}
// Test plugin remains a local build artifact and is not distributed.
renameSync(server+'plugins/harbor-verifier.jar',root+'build/verification/harbor-verifier.jar');
console.log('PASS all three real headless Paper boots; no Minecraft GUI or network player used.');
