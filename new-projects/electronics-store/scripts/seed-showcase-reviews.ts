import 'dotenv/config';
import {readFile} from 'node:fs/promises';
import {db} from '../src/server/db';
export async function seedShowcaseReviews(){
 if(process.env.TEST_MODE!=='true')throw new Error('Showcase content requires TEST_MODE=true');
 const buyer=await db.user.findUniqueOrThrow({where:{email:'buyer@velmren.local'}});
 const entries=JSON.parse(await readFile(new URL('../data/showcase-reviews.json',import.meta.url),'utf8'));
 for(const [index,entry] of entries.entries()){
  await db.product.findUniqueOrThrow({where:{id:entry.productId}});
  const data={...entry,userId:buyer.id,status:'APPROVED',isDemo:true,createdAt:new Date(Date.UTC(2026,8,2+index))};
  await db.review.upsert({where:{id:`showcase-review-${index+1}`},create:{id:`showcase-review-${index+1}`,...data},update:data});
 }
 console.log(`Saved ${entries.length} authored showcase reviews.`);
}
if(process.argv[1]?.endsWith('seed-showcase-reviews.ts'))seedShowcaseReviews().finally(()=>db.$disconnect());
