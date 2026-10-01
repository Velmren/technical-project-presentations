import 'dotenv/config';
import {db} from '../../src/server/db';

// Keep moderation fixtures for inspection without presenting them as real reviews.
export default async function teardown(){
 if(process.env.TEST_MODE!=='true')return;
 try{
  await db.review.updateMany({where:{user:{email:{startsWith:'browser-',endsWith:'@velmren.local'}},title:{startsWith:'Браузерная проверка '}},data:{isDemo:true}});
 }finally{await db.$disconnect()}
}
