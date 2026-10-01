import {spawn} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync,openSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..','.client');mkdirSync(root+'/game',{recursive:true});
writeFileSync(root+'/game/options.txt','version:4671\nrenderDistance:8\nsimulationDistance:4\nguiScale:2\nmaxFps:60\nfullscreen:false\nclouds:0\n');
const args=JSON.parse(readFileSync(root+'/args.json','utf8'));
const log=openSync(root+'/client-console.log','w');
const java='C:/Program Files/Eclipse Adoptium/jdk-21.0.6.7-hotspot/bin/javaw.exe';
const p=spawn(java,args,{cwd:root,windowsHide:true,detached:true,stdio:['ignore',log,log]});p.unref();console.log('GRAPHICAL_CLIENT_PID',p.pid);
