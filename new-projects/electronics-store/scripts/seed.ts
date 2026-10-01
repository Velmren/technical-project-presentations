import 'dotenv/config';
import {seedShowcaseReviews} from './seed-showcase-reviews';
import {readFile} from 'node:fs/promises';
import {db} from '../src/server/db';
import {auth} from '../src/server/auth';
import {ensureBucket} from '../src/server/storage';
const categoryNames:Record<string,string>={smartphones:'Смартфоны',laptops:'Ноутбуки',tablets:'Планшеты',audio:'Аудио',watches:'Умные часы',gaming:'Игры и консоли',cameras:'Фото и видео','smart-home':'Умный дом',accessories:'Аксессуары',home:'Для дома'};
async function seed(){
 if(process.env.TEST_MODE!=='true')throw new Error('Demo seed requires TEST_MODE=true');
 const password=process.env.DEMO_PASSWORD;if(!password)throw new Error('DEMO_PASSWORD required');
 for(const [slug,name] of Object.entries(categoryNames))await db.category.upsert({where:{slug},create:{slug,name},update:{name}});
 const products=JSON.parse(await readFile(new URL('../data/catalog.json',import.meta.url),'utf8'));
 for(const p of products){
  await db.brand.upsert({where:{name:p.brand},create:{name:p.brand},update:{}});
  const {variants,...data}=p;
  await db.product.upsert({where:{id:p.id},create:data,update:data});
  for(const variant of variants)await db.variant.upsert({where:{id:variant.id},create:{...variant,productId:p.id},update:{...variant,stock:undefined,productId:p.id}});
 }
 for(const [email,name,role] of [['buyer@velmren.local','Александр Волков','CUSTOMER'],['admin@velmren.local','Администратор Velmren','ADMIN']]){
  let user=await db.user.findUnique({where:{email}});
  if(!user){const registered=await auth.api.signUpEmail({body:{email,name,password}});user=await db.user.findUniqueOrThrow({where:{id:registered.user.id}});}
  await db.user.update({where:{id:user.id},data:{role,phone:'+7 999 123-45-67',emailVerified:true}});
 }
 const buyer=await db.user.findUniqueOrThrow({where:{email:'buyer@velmren.local'}});
 if(!await db.address.count({where:{userId:buyer.id}}))await db.address.create({data:{userId:buyer.id,name:buyer.name,phone:'+7 999 123-45-67',city:'Москва',street:'ул. Тверская, д. 12, кв. 24',postalCode:'125009',isDefault:true}});
 await db.promo.upsert({where:{code:'WELCOME10'},create:{code:'WELCOME10',type:'PERCENT',value:10,maxDiscount:5000,minSubtotal:1000},update:{}});
 await db.promo.upsert({where:{code:'TECH2000'},create:{code:'TECH2000',type:'FIXED',value:2000,maxDiscount:2000,minSubtotal:20000},update:{}});
 for(const p of products){
  const stats=await db.review.aggregate({where:{productId:p.id,status:'APPROVED',isDemo:false},_avg:{rating:true},_count:true});
  await db.product.update({where:{id:p.id},data:{rating:stats._avg.rating??0,reviewCount:stats._count}});
 }
 if(!await db.order.count({where:{userId:buyer.id}})){
  for(let i=0;i<3;i++){
   const p=products[i],v=p.variants[0],status=['DELIVERED','SHIPPED','PENDING_PAYMENT'][i];
   await db.order.create({data:{number:`VE-100${i+1}`,userId:buyer.id,checkoutScope:`user:${buyer.id}`,idempotencyKey:`seed-demo-order-${i}`,status,paymentStatus:i<2?'PAID':'PENDING',paymentMethod:'card',deliveryMethod:'courier',subtotal:v.price,discount:0,shipping:0,total:v.price,address:{name:buyer.name,phone:'+7 999 123-45-67',city:'Москва',street:'ул. Тверская, д. 12, кв. 24'},testMode:true,trackingNumber:i===1?'TEST-VE-1002':null,createdAt:new Date(Date.now()-(3-i)*86400000*5),items:{create:{productId:p.id,variantId:v.id,name:p.name,slug:p.slug,image:p.images[0],color:v.color,storage:v.storage,price:v.price,quantity:1}},events:{create:{status,message:'Заказ принят.'}}}});
  }
  await db.user.update({where:{id:buyer.id},data:{bonuses:2500}});
 }
 await seedShowcaseReviews();
 await ensureBucket();
 console.log(`Seed complete: ${products.length} products, demo buyer/admin, PostgreSQL + MinIO.`);
}
seed().finally(()=>db.$disconnect());
