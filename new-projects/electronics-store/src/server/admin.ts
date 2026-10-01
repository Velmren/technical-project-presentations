import {z} from 'zod';
import {db} from './db';
import {ApiError,assertStaff} from './validation';
import {orderInclude,transitionOrder,lock} from './commerce';
const id=z.string().min(1).max(150);
const image=z.string().max(2000).refine(v=>v.startsWith('/')||/^https?:\/\//.test(v),'Некорректный URL');
const productFields=z.object({slug:z.string().min(2).max(120).regex(/^[a-z0-9-]+$/),name:z.string().min(2).max(200),brand:z.string().min(1).max(100),category:z.string().min(1).max(100),subcategory:z.string().max(100).optional(),description:z.string().max(10000),tagline:z.string().max(500).optional(),images:z.array(image).max(20),specs:z.record(z.string(),z.string().max(2000)).optional(),features:z.array(z.string()).max(30).optional(),inBox:z.array(z.string()).max(30).optional(),featured:z.boolean().optional(),active:z.boolean().optional(),badge:z.string().max(50).nullable().optional(),modelUrl:image.nullable().optional(),videoUrl:image.nullable().optional()});
const schemas:Record<string,z.ZodObject<any>>={
 products:productFields,
 variants:z.object({productId:id,sku:z.string().min(2).max(100),color:z.string().max(80),colorHex:z.string().regex(/^#[0-9a-fA-F]{6}$/),storage:z.string().max(80),active:z.boolean().optional(),images:z.array(image).max(20).optional(),price:z.number().int().min(1).max(10000000),oldPrice:z.number().int().min(1).max(10000000).nullable().optional(),stock:z.number().int().min(0).max(1000000)}),
 categories:z.object({slug:z.string().min(2).regex(/^[a-z0-9-]+$/),name:z.string().min(2).max(100)}),
 brands:z.object({name:z.string().min(1).max(100)}),
 promos:z.object({code:z.string().min(2).max(40).transform(v=>v.toUpperCase()),type:z.enum(['PERCENT','FIXED']),value:z.number().int().positive(),maxDiscount:z.number().int().nonnegative(),minSubtotal:z.number().int().nonnegative(),active:z.boolean(),expiresAt:z.coerce.date().nullable().optional()}),
};
const models:Record<string,string>={products:'product',variants:'variant',categories:'category',brands:'brand',promos:'promo',reviews:'review',questions:'question',support:'ticket',orders:'order',users:'user'};
export async function admin(resource:string,method:string,body:any,user:{id:string;role:string}){
 assertStaff(user);
 if(resource==='dashboard'&&method==='GET'){
  const [products,orders,customers,revenue,pendingReviews]=await Promise.all([db.product.count(),db.order.count(),db.user.count({where:{role:'CUSTOMER'}}),db.order.aggregate({where:{paymentStatus:'PAID'},_sum:{total:true}}),db.review.count({where:{status:'PENDING'}})]);
  return {products,orders,customers,revenue:revenue._sum.total??0,pendingReviews};
 }
 const model=models[resource];if(!model)throw new ApiError('Раздел не найден',404);
 const delegate=(db as any)[model];
 if(method==='GET')return delegate.findMany({take:500,...(resource==='products'?{include:{variants:true}}:resource==='orders'?{include:orderInclude,orderBy:{createdAt:'desc'}}:resource==='users'?{select:{id:true,name:true,email:true,role:true,bonuses:true}}:{})});
 if(method==='DELETE'){
  if(user.role!=='ADMIN')throw new ApiError('Удаление доступно администратору',403);
  const key=id.parse(body.id);
  if(['orders','users'].includes(resource))throw new ApiError('Удаление истории заказов и пользователей недоступно',403);
  if(resource==='products'){await db.product.update({where:{id:key},data:{active:false}});return {ok:true};}
  if(resource==='variants'&&await db.orderItem.count({where:{variantId:key}}))throw new ApiError('Вариант используется в заказах. Установите остаток 0.',409);
  if(resource==='reviews'){
   await db.$transaction(async tx=>{
    const r=await tx.review.delete({where:{id:key}});
    const stats=await tx.review.aggregate({where:{productId:r.productId,status:'APPROVED',isDemo:false},_avg:{rating:true},_count:true});
    await tx.product.update({where:{id:r.productId},data:{rating:stats._avg.rating??0,reviewCount:stats._count}});
   });return {ok:true};
  }
  await delegate.delete({where:{id:key}});return {ok:true};
 }
 if(resource==='orders'&&method==='PATCH')return transitionOrder(id.parse(body.id),z.enum(['SHIPPED','DELIVERED','CANCELLED']).parse(body.status),user);
 if(resource==='users'&&method==='PATCH'){
  if(user.role!=='ADMIN')throw new ApiError('Только администратор меняет роли',403);
  if(body.id===user.id&&body.role!=='ADMIN')throw new ApiError('Нельзя понизить собственную роль');
  return db.user.update({where:{id:id.parse(body.id)},data:{role:z.enum(['ADMIN','STAFF','CUSTOMER']).parse(body.role)},select:{id:true,name:true,email:true,role:true}});
 }
 if(resource==='reviews'&&method==='PATCH'){
  const review=await db.review.update({where:{id:id.parse(body.id)},data:{status:z.enum(['APPROVED','REJECTED','PENDING']).parse(body.status)}});
  const stats=await db.review.aggregate({where:{productId:review.productId,status:'APPROVED',isDemo:false},_avg:{rating:true},_count:true});
  await db.product.update({where:{id:review.productId},data:{rating:stats._avg.rating??0,reviewCount:stats._count}});return review;
 }
 if(resource==='questions'&&method==='PATCH')return db.question.update({where:{id:id.parse(body.id)},data:z.object({answer:z.string().max(5000).optional(),status:z.enum(['APPROVED','REJECTED','PENDING']).optional()}).parse(body)});
 if(resource==='support'&&method==='PATCH'){
  const ticketId=id.parse(body.id);
  const input=z.object({status:z.enum(['OPEN','RESOLVED']).optional(),message:z.string().min(1).max(5000).optional()}).parse(body);
  return db.$transaction(async tx=>{
   await lock(tx,`ticket:${ticketId}`);
   const ticket=await tx.ticket.findUniqueOrThrow({where:{id:ticketId}});
   return tx.ticket.update({where:{id:ticket.id},data:{status:input.status,messages:input.message?[...(ticket.messages as any[]),{text:input.message,staff:true,createdAt:new Date().toISOString()}]:undefined}});
  });
 }
 const schema=schemas[resource];if(!schema)throw new ApiError('Операция не поддерживается',405);
 const data=method==='POST'?schema.parse(body):schema.partial().parse(body);
 if(resource==='variants'&&method==='PATCH'&&Object.hasOwn(body,'stock')){
  const variantId=id.parse(body.id);
  const expectedStock=z.number().int().min(0).max(1000000).parse(body.expectedStock);
  return db.$transaction(async tx=>{
   const updated=await tx.variant.updateMany({where:{id:variantId,stock:expectedStock},data});
   if(updated.count!==1)throw new ApiError('Остаток изменился. Обновите данные перед сохранением.',409);
   return tx.variant.findUniqueOrThrow({where:{id:variantId}});
  });
 }
 if(resource==='promos'){
  const existing=method==='PATCH'?await db.promo.findUniqueOrThrow({where:{id:id.parse(body.id)}}):null;
  const merged={...existing,...data};
  if(merged.type==='PERCENT'&&Number(merged.value)>100)throw new ApiError('Скидка не может превышать 100%');
 }
 if(method==='POST')return delegate.create({data:resource==='products'?{features:[],inBox:[],...data}:data});
 if(method==='PATCH')return delegate.update({where:{id:id.parse(body.id)},data});
 throw new ApiError('Метод не поддерживается',405);
}
