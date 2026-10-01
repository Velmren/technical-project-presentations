import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function excerpt(file,key){const raw=await fs.readFile(path.join(root,'src/main/resources',file),'utf8');const lines=raw.split(/\r?\n/);const start=lines.findIndex(l=>l===`  ${key}:`);if(start<0)throw new Error(`Missing ${key} in ${file}`);let end=start+1;while(end<lines.length&&!/^  \S.*:\s*$/.test(lines[end]))end++;return lines[0]+'\n'+lines.slice(start,end).join('\n').trimEnd();}
const result={npc:await excerpt('npcs.yml','guard'),dialogue:await excerpt('dialogs.yml','elder'),quest:await excerpt('quests.yml','mill'),shop:await excerpt('shops.yml','market')};
await fs.writeFile(path.join(root,'web/assets/config-examples.json'),JSON.stringify(result,null,2));
const appPath=path.join(root,'web/app.js');
const app=await fs.readFile(appPath,'utf8');
const marker=app.indexOf('let currentCode=');
if(marker<0)throw new Error('Landing app marker is missing');
await fs.writeFile(appPath,'const examples='+JSON.stringify(result,null,2)+';\n'+app.slice(marker));
console.log('Landing YAML excerpts synced from actual plugin resources.');
