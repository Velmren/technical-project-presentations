// Official Mojang artifacts only. Isolated local development profile, no account credentials.
import {mkdir,writeFile,readFile,stat,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
const version=process.argv[2]??'1.21.11',base=resolve(import.meta.dirname,'..','.client'),root=version==='1.21.11'?base:resolve(import.meta.dirname,'..','.client-latest');
async function get(url){const r=await fetch(url);if(!r.ok)throw Error(`${r.status} ${url}`);return r;}
async function artifact(a,p){
 await mkdir(dirname(p),{recursive:true});
 try{const b=await readFile(p);if(createHash('sha1').update(b).digest('hex')===a.sha1)return;}catch{}
 if(root!==base){try{const cached=await readFile(p.replace(root,base));if(createHash('sha1').update(cached).digest('hex')===a.sha1){await writeFile(p,cached);return;}}catch{}}
 const b=Buffer.from(await(await get(a.url)).arrayBuffer());
 if(createHash('sha1').update(b).digest('hex')!==a.sha1)throw Error('SHA1 mismatch '+p);
 await writeFile(p,b);
}
const manifest=await(await get('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')).json();
const meta=await(await get(manifest.versions.find(v=>v.id===version).url)).json();
await mkdir(root,{recursive:true});await writeFile(root+'/version.json',JSON.stringify(meta,null,2));
const cp=[];const jobs=[];
jobs.push(()=>artifact(meta.downloads.client,root+'/client.jar'));cp.push(root+'/client.jar');
for(const l of meta.libraries){
 let allow=!l.rules;for(const rule of l.rules??[])if(!rule.os||rule.os.name==='windows')allow=rule.action==='allow';
 if(!allow)continue;
 const a=l.downloads?.artifact;if(a){const p=root+'/libraries/'+a.path;cp.push(p);jobs.push(()=>artifact(a,p));}
}
const ai=await(await get(meta.assetIndex.url)).json();await mkdir(root+'/assets/indexes',{recursive:true});
await writeFile(root+'/assets/indexes/'+meta.assetIndex.id+'.json',JSON.stringify(ai));
for(const a of Object.values(ai.objects)){const hash=a.hash;const p=root+'/assets/objects/'+hash.slice(0,2)+'/'+hash;jobs.push(()=>artifact({sha1:hash,url:'https://resources.download.minecraft.net/'+hash.slice(0,2)+'/'+hash},p));}
let done=0;await Promise.all(Array.from({length:12},async()=>{while(jobs.length){await jobs.pop()();if(++done%300===0)console.log('Verified artifacts',done);}}));
await writeFile(root+'/classpath.txt',cp.join(';'));
await writeFile(root+'/args.json',JSON.stringify(['-Xmx1536M','-Djava.library.path='+root+'/natives','-cp',cp.join(';'),meta.mainClass,'--username','NPCDev','--version',version,'--gameDir',root+'/game','--assetsDir',root+'/assets','--assetIndex',meta.assetIndex.id,'--uuid','00000000-0000-0000-0000-000000000001','--accessToken','0','--userType','legacy','--versionType','release','--width','1440','--height','900'],null,2));
console.log('Official client prepared',version,done,'verified artifacts; isolated local dev, no external account authentication.');
