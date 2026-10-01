import 'dotenv/config';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {db} from '../../src/server/db';
const baselinePath=new URL('./persistence-baseline.json',import.meta.url);
const orderId='cmuk3rjts000kh4i0ebnz65m8';
const order=await db.order.findUniqueOrThrow({where:{id:orderId},include:{items:{orderBy:{id:'asc'}},events:{orderBy:{id:'asc'}},paymentEvents:{orderBy:{id:'asc'}}}});
if(!order.userId)throw new Error('Persistence fixture requires an account-owned order');
const profile=await db.user.findUniqueOrThrow({where:{id:order.userId},select:{id:true,name:true,email:true,phone:true,bonuses:true,settings:true,addresses:{orderBy:{id:'asc'}}}});
const counts={products:await db.product.count(),variants:await db.variant.count(),orders:await db.order.count(),users:await db.user.count()};
const data=JSON.parse(JSON.stringify({order,profile,counts}));
const hash=createHash('sha256').update(JSON.stringify(data)).digest('hex');
const startedAt=execFileSync('docker',['inspect','velmren-electronics-postgres-1','--format','{{.State.StartedAt}}'],{encoding:'utf8'}).trim();
const snapshot={capturedAt:new Date().toISOString(),startedAt,hash,data};
await db.$disconnect();
if(process.argv[2]==='before'){
 await writeFile(baselinePath,JSON.stringify(snapshot,null,2));
 console.log(JSON.stringify({phase:'before',capturedAt:snapshot.capturedAt,startedAt,hash,order:order.number,status:order.status,paymentStatus:order.paymentStatus,total:order.total,profile:profile.email,bonuses:profile.bonuses,counts}));
}else{
 const before=JSON.parse(await readFile(baselinePath,'utf8'));
 if(before.hash!==hash)throw new Error(`Persistence mismatch: ${before.hash} != ${hash}`);
 if(before.startedAt===startedAt)throw new Error('PostgreSQL container did not restart');
 const report=`# PostgreSQL persistence QA\n\nResult: **PASS**. Existing data is byte-equivalent after restarting only this project's PostgreSQL container.\n\n- Project: \`velmren-electronics\`; container: \`velmren-electronics-postgres-1\`; port: \`55435\`.\n- Command: \`docker compose restart postgres\`; health confirmed before reading again. No reset, migration, seed, Next.js restart or other service restart.\n- Before snapshot: ${before.capturedAt}; container started: ${before.startedAt}.\n- After snapshot: ${snapshot.capturedAt}; container started: ${startedAt}.\n- Existing root E2E order: \`${order.number}\` / \`${order.id}\`, status \`${order.status}\`, payment \`${order.paymentStatus}\`, total **${order.total} RUB**.\n- Profile: ${profile.name}, \`${profile.email}\`; bonuses **${profile.bonuses}**; saved addresses **${profile.addresses.length}**.\n- Unchanged counts: products **${counts.products}**, variants **${counts.variants}**, orders **${counts.orders}**, users **${counts.users}**.\n- Compared full order with item snapshots, events and payment events; selected profile fields/settings/addresses; all counts.\n- SHA-256 before: \`${before.hash}\`.\n- SHA-256 after: \`${hash}\`.\n\nServer test result will be recorded below after \`npm test\`.\n`;
 await writeFile(new URL('../../docs/PERSISTENCE-QA.md',import.meta.url),report);
 console.log(JSON.stringify({phase:'after',result:'PASS',hash,counts}));
}
