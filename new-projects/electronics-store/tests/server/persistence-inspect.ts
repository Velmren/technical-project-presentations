import 'dotenv/config';
import {db} from '../../src/server/db';
const orders=await db.order.findMany({orderBy:{createdAt:'desc'},take:12,select:{id:true,number:true,user:{select:{email:true,name:true}},status:true,total:true,createdAt:true}});
console.log(JSON.stringify(orders,null,2));
await db.$disconnect();
