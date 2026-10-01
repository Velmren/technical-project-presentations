import {publicReviewWhere} from './review-visibility';
import {randomBytes,createHash} from 'node:crypto';
import {db} from './db';
import {Prisma} from './generated/prisma/client';
import {ApiError,checkoutSchema,addressSchema,type CheckoutInput} from './validation';
import {paymentProvider,shippingProvider,type PaymentEventInput,type ShipmentInput} from './providers';
type Tx=Prisma.TransactionClient;
export const orderInclude={items:true,events:{orderBy:{createdAt:'asc' as const}}};
export async function lock(tx:Tx,key:string){await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;}
export const genuineReviews={where:publicReviewWhere(),select:{rating:true}};
export function productView(p:any,selectedVariantId?:string){
 const availableVariants=p.variants.filter((v:any)=>v.active!==false);
 const selected=availableVariants.find((v:any)=>v.id===selectedVariantId)??[...availableVariants].sort((a:any,b:any)=>a.price-b.price||a.id.localeCompare(b.id))[0];
 const variants=selected?[selected,...availableVariants.filter((v:any)=>v.id!==selected.id)]:[];
 return {...p,...(p.reviews?{rating:p.reviews.length?p.reviews.reduce((sum:number,r:any)=>sum+r.rating,0)/p.reviews.length:0,reviewCount:p.reviews.length}:{}),images:selected?.images?.length?selected.images:p.images,variants,selectedVariantId:selected?.id??null,price:selected?.price??0,oldPrice:selected?.oldPrice??null,stock:selected?.stock??0};
}
export async function discountFor(tx:Tx|typeof db,subtotal:number,code?:string|null){
 if(!code)return 0;
 const p=await tx.promo.findUnique({where:{code:code.trim().toUpperCase()}});
 if(!p||!p.active||(p.expiresAt&&p.expiresAt<new Date())||subtotal<p.minSubtotal)throw new ApiError('Промокод недействителен или сумма заказа недостаточна');
 return Math.min(subtotal,p.maxDiscount,p.type==='PERCENT'?Math.floor(subtotal*p.value/100):p.value);
}
export async function resolveCart(userId?:string,guestToken?:string){
 return db.$transaction(async tx=>{
  await lock(tx,userId?`user:${userId}`:`guest:${guestToken}`);
  if(userId){
   const own=await tx.cart.upsert({where:{userId},create:{userId},update:{}});
   if(guestToken){
    await lock(tx,`guest:${guestToken}`);
    const guest=await tx.cart.findUnique({where:{guestToken},include:{items:{include:{variant:true}}}});
    if(guest&&guest.id!==own.id){
     for(const item of guest.items){
      if(!item.variant.active)continue;
      const current=await tx.cartItem.findUnique({where:{cartId_variantId:{cartId:own.id,variantId:item.variantId}}});
      const quantity=Math.min(99,item.variant.stock,(current?.quantity??0)+item.quantity);
      if(quantity>0)await tx.cartItem.upsert({where:{cartId_variantId:{cartId:own.id,variantId:item.variantId}},create:{cartId:own.id,variantId:item.variantId,quantity},update:{quantity}});
     }
     if(!own.promoCode&&guest.promoCode)await tx.cart.update({where:{id:own.id},data:{promoCode:guest.promoCode}});
     await tx.cart.delete({where:{id:guest.id}});
    }
   }
   return own.id;
  }
  return (await tx.cart.upsert({where:{guestToken:guestToken!},create:{guestToken:guestToken!},update:{}})).id;
 });
}
export async function cartView(cartId:string){
 const cart=await db.cart.findUniqueOrThrow({where:{id:cartId},include:{items:{include:{variant:{include:{product:{include:{variants:true,reviews:genuineReviews}}}}}}}});
 const items=cart.items.map(i=>({id:i.id,variantId:i.variantId,quantity:i.quantity,availabilityError:!i.variant.active||!i.variant.product.active?'Вариант больше не продаётся. Удалите его из корзины.':i.variant.stock<i.quantity?'Недостаточно товара на складе':null,variant:i.variant,product:productView(i.variant.product,i.variantId),lineTotal:i.quantity*i.variant.price}));
 const subtotal=items.reduce((s,i)=>s+i.lineTotal,0);
 let discount=0,promoError:string|null=null;try{discount=await discountFor(db,subtotal,cart.promoCode);}catch(e){if(!(e instanceof ApiError))throw e;promoError=e.message;}
 const shipping=subtotal===0||subtotal>=30000?0:490;
 return {id:cart.id,items,subtotal,discount,shipping,total:subtotal-discount+shipping,promoCode:cart.promoCode,promoError};
}
export async function mutateCart(cartId:string,method:string,body:any){
 await db.$transaction(async tx=>{
  const cart=await tx.cart.findUniqueOrThrow({where:{id:cartId}});
  await lock(tx,cart.userId?`user:${cart.userId}`:`guest:${cart.guestToken}`);
  if(typeof body.promoCode==='string'){
   if(body.promoCode.length>40)throw new ApiError('Промокод слишком длинный');
   const items=await tx.cartItem.findMany({where:{cartId},include:{variant:true}});
   const subtotal=items.reduce((s,i)=>s+i.quantity*i.variant.price,0);
   await discountFor(tx,subtotal,body.promoCode||null);
   await tx.cart.update({where:{id:cartId},data:{promoCode:body.promoCode.toUpperCase()||null}});return;
  }
  if(method==='DELETE'){await tx.cartItem.deleteMany({where:{cartId,...(body.variantId?{variantId:String(body.variantId)}:{})}});return;}
  const variantId=String(body.variantId??'');
  const quantity=Number(body.quantity??1);
  if(!Number.isInteger(quantity)||quantity<1||quantity>99)throw new ApiError('Количество должно быть от 1 до 99');
  const variant=await tx.variant.findUnique({where:{id:variantId},include:{product:true}});
  if(!variant||!variant.product.active)throw new ApiError('Товар не найден',404);
  if(!variant.active)throw new ApiError('Вариант больше не продаётся',409);
  const existing=await tx.cartItem.findUnique({where:{cartId_variantId:{cartId,variantId}}});
  const next=method==='POST'?quantity+(existing?.quantity??0):quantity;
  if(next>variant.stock||next>99)throw new ApiError('Недостаточно товара на складе',409);
  await tx.cartItem.upsert({where:{cartId_variantId:{cartId,variantId}},create:{cartId,variantId,quantity:next},update:{quantity:next}});
 });
 return cartView(cartId);
}
export type OrderActor={id:string;role:string}|{guestHash:string};
export const guestHash=(token:string)=>createHash('sha256').update(token).digest('hex');
function assertOrderAccess(actor:OrderActor,order:{userId:string|null;guestAccessHash:string|null},staff=true){
 if('id' in actor){if(actor.id===order.userId||(staff&&['ADMIN','STAFF'].includes(actor.role)))return;}
 else if(!order.userId&&order.guestAccessHash&&actor.guestHash===order.guestAccessHash)return;
 throw new ApiError('Нет доступа',403);
}
export function orderView(order:any){const {guestAccessHash,checkoutScope,...visible}=order;return {...visible,isGuest:!order.userId};}
export async function claimGuestOrders(user:{id:string;email:string},hash:string){
 return db.$transaction(async tx=>{
  await lock(tx,`user:${user.id}`);await lock(tx,`guest-orders:${hash}`);
  const candidates=await tx.order.findMany({where:{userId:null,guestAccessHash:hash},orderBy:[{createdAt:'desc'},{id:'asc'}]});
  const profile=await tx.user.findUniqueOrThrow({where:{id:user.id},select:{phone:true}});
  let needsPhone=!profile.phone.trim();
  for(const order of candidates){
   const contact=(order.address as any)?.contact;
   if(contact?.email?.trim().toLowerCase()!==user.email.trim().toLowerCase())continue;
   await lock(tx,`order:${order.id}`);
   const claimed=await tx.order.updateMany({where:{id:order.id,userId:null,guestAccessHash:hash},data:{userId:user.id,guestAccessHash:null}});
   if(!claimed.count)continue;
   if(needsPhone&&typeof contact.phone==='string'&&contact.phone.trim()){
    // Compare-and-set also preserves a profile edit made outside this claim transaction.
    await tx.user.updateMany({where:{id:user.id,phone:profile.phone},data:{phone:contact.phone}});
    needsPhone=false;
   }
   if(order.deliveryMethod==='courier'){
    const parsed=addressSchema.safeParse(order.address);
    if(parsed.success){
     const {name,phone,city,street,postalCode}=parsed.data;
     const duplicate=await tx.address.findFirst({where:{userId:user.id,name,phone,city,street}});
     if(!duplicate)await tx.address.create({data:{userId:user.id,name,phone,city,street,postalCode,isDefault:await tx.address.count({where:{userId:user.id}})===0}});
    }
   }
  }
 });
}
export async function checkout(userId:string|undefined,raw:CheckoutInput,guest?:{cartToken:string;accessHash:string}){
 const input=checkoutSchema.parse(raw);
 if(!userId&&(!guest||!input.contact))throw new ApiError('Укажите контактные данные');
 if(!userId&&(input.useBonuses||input.addressId))throw new ApiError('Бонусы и сохранённые адреса доступны после входа',401);
 const checkoutScope=userId?`user:${userId}`:`guest:${guest!.accessHash}`;
 return db.$transaction(async tx=>{
  await lock(tx,userId?`user:${userId}`:`guest:${guest!.cartToken}`);
  if(!userId)await lock(tx,`guest-orders:${guest!.accessHash}`);
  const prior=await tx.order.findFirst({where:{idempotencyKey:input.idempotencyKey,...(userId?{userId}:{checkoutScope})},include:orderInclude});
  if(prior){assertOrderAccess(userId?{id:userId,role:'CUSTOMER'}:{guestHash:guest!.accessHash},prior,false);return prior;}
  const cart=await tx.cart.findUnique({where:userId?{userId}:{guestToken:guest!.cartToken},include:{items:{include:{variant:{include:{product:true}}}}}});
  if(!cart?.items.length)throw new ApiError('Корзина пуста');
  const subtotal=cart.items.reduce((s,i)=>s+i.quantity*i.variant.price,0);
  const promoCode=input.promoCode??cart.promoCode;
  const promoDiscount=await discountFor(tx,subtotal,promoCode);
  const user=userId?await tx.user.findUniqueOrThrow({where:{id:userId}}):null;
  const bonuses=Math.min(input.useBonuses,user?.bonuses??0,Math.floor((subtotal-promoDiscount)*0.3));
  const discount=promoDiscount+bonuses;
  const shipping=input.deliveryMethod==='pickup'||subtotal>=30000?0:490;
  let address:any=input.address??{name:input.contact?.name??user?.name,phone:input.contact?.phone??user?.phone,city:'Москва',street:'Самовывоз'};
  if(input.addressId&&userId){address=await tx.address.findFirst({where:{id:input.addressId,userId}});if(!address)throw new ApiError('Адрес не найден',404);}
  address={...address,contact:input.contact??{name:user!.name,email:user!.email,phone:user!.phone},recipient:input.recipient,pickupPoint:input.pickupPoint};
  if(input.deliveryMethod==='courier'&&!input.address&&!input.addressId)throw new ApiError('Укажите адрес доставки');
  for(const item of [...cart.items].sort((a,b)=>a.variantId.localeCompare(b.variantId))){
   if(!item.variant.active||!item.variant.product.active)throw new ApiError('Вариант снят с продажи. Удалите его из корзины.',409);
   const result=await tx.variant.updateMany({where:{id:item.variantId,active:true,stock:{gte:item.quantity}},data:{stock:{decrement:item.quantity}}});
   if(result.count!==1)throw new ApiError(`Недостаточно товара: ${item.variant.product.name}`,409);
  }
  if(bonuses&&userId)await tx.user.update({where:{id:userId},data:{bonuses:{decrement:bonuses}}});
  if(userId&&input.saveAddress&&input.address&&!input.addressId){
   const {name,phone,city,street,postalCode}=input.address;
   const duplicate=await tx.address.findFirst({where:{userId,name,phone,city,street}});
   if(!duplicate)await tx.address.create({data:{userId,name,phone,city,street,postalCode,isDefault:await tx.address.count({where:{userId}})===0}});
  }
  const status=input.paymentMethod==='cash'?'PROCESSING':'PENDING_PAYMENT';
  const order=await tx.order.create({data:{number:`VE-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`,userId,guestAccessHash:userId?null:guest!.accessHash,checkoutScope,idempotencyKey:input.idempotencyKey,status,paymentMethod:input.paymentMethod,deliveryMethod:input.deliveryMethod,address:JSON.parse(JSON.stringify(address)),comment:input.comment??'',promoCode,subtotal,discount,shipping,total:subtotal-discount+shipping,bonusesSpent:bonuses,testMode:process.env.TEST_MODE==='true',items:{create:cart.items.map(i=>({productId:i.variant.productId,variantId:i.variantId,name:i.variant.product.name,slug:i.variant.product.slug,image:i.variant.images[0]??i.variant.product.images[0]??'',color:i.variant.color,storage:i.variant.storage,price:i.variant.price,quantity:i.quantity}))},events:{create:{status,message:input.paymentMethod==='cash'?'Заказ создан. Оплата при получении.':'Заказ создан. Ожидает оплаты.'}}},include:orderInclude});
  await tx.cartItem.deleteMany({where:{cartId:cart.id}});
  await tx.cart.update({where:{id:cart.id},data:{promoCode:null}});
  return order;
 },{timeout:15000});
}
export async function getOrder(id:string,user:OrderActor){
 const order=await db.order.findUnique({where:{id},include:orderInclude});if(!order)throw new ApiError('Заказ не найден',404);assertOrderAccess(user,order);return order;
}
export async function payment(id:string,user:OrderActor,result:string,eventId:string){
 if(process.env.TEST_MODE!=='true')throw new ApiError('Тестовая оплата отключена',403);
 if(!['success','failure'].includes(result)||eventId.length<8||eventId.length>120)throw new ApiError('Некорректное событие оплаты');
 return db.$transaction(async tx=>{
  await lock(tx,`order:${id}`);
  const order=await tx.order.findUnique({where:{id},include:orderInclude});if(!order)throw new ApiError('Заказ не найден',404);
  assertOrderAccess(user,order);
  if(!order.testMode)throw new ApiError('Заказ не тестовый',403);
  const event=await tx.paymentEvent.findUnique({where:{eventId}});
  const resolution=await paymentProvider.resolveEvent({orderId:id,eventId,result:result as PaymentEventInput['result']},event);
  if(resolution.kind==='repeated')return order;
  if(order.status!=='PENDING_PAYMENT')throw new ApiError('Заказ уже оплачен или отменён',409);
  await tx.paymentEvent.create({data:{orderId:id,eventId,result}});
  return tx.order.update({where:{id},data:{paymentStatus:resolution.paymentStatus,status:resolution.status,events:{create:{status:resolution.status,message:resolution.message}}},include:orderInclude});
 });
}
export async function cancelOrder(id:string,user:OrderActor){
 const initial=await getOrder(id,user);
 return db.$transaction(async tx=>{
  await lock(tx,initial.userId?`user:${initial.userId}`:`guest-orders:${initial.guestAccessHash}`);
  await lock(tx,`order:${id}`);
  const order=await tx.order.findUnique({where:{id},include:orderInclude});if(!order)throw new ApiError('Заказ не найден',404);assertOrderAccess(user,order);
  if(order.status==='CANCELLED')return order;
  if(!['PENDING_PAYMENT','PROCESSING'].includes(order.status))throw new ApiError('Отмена после передачи в доставку недоступна',409);
  if(!order.stockReturned){
   for(const item of [...order.items].sort((a,b)=>a.variantId.localeCompare(b.variantId)))await tx.variant.updateMany({where:{id:item.variantId},data:{stock:{increment:item.quantity}}});
   if(order.bonusesSpent&&order.userId)await tx.user.update({where:{id:order.userId},data:{bonuses:{increment:order.bonusesSpent}}});
  }
  const refund=order.paymentStatus==='PAID'?await paymentProvider.refund({orderId:id,testMode:order.testMode}):null;
  return tx.order.update({where:{id},data:{status:'CANCELLED',stockReturned:true,paymentStatus:refund?.paymentStatus??order.paymentStatus,events:{create:{status:'CANCELLED',message:refund?.message??'Заказ отменён. Резерв снят.'}}},include:orderInclude});
 });
}
export async function transitionOrder(id:string,status:string,user:{id:string;role:string},simulation=false){
 if(status==='CANCELLED')return cancelOrder(id,user);
 if(simulation&&process.env.TEST_MODE!=='true')throw new ApiError('Симуляция отключена',403);
 return db.$transaction(async tx=>{
  await lock(tx,`order:${id}`);
  const order=await tx.order.findUnique({where:{id},include:orderInclude});if(!order)throw new ApiError('Заказ не найден',404);assertOrderAccess(user,order);
  if(!simulation&&!['ADMIN','STAFF'].includes(user.role))throw new ApiError('Нет доступа',403);
  if(simulation&&!order.testMode)throw new ApiError('Симуляция только тестовых заказов',403);
  const shipment=await shippingProvider.transition({orderId:id,orderNumber:order.number,currentStatus:order.status,nextStatus:status,paymentMethod:order.paymentMethod,paymentStatus:order.paymentStatus,testMode:order.testMode} as ShipmentInput);
  const earned=status==='DELIVERED'&&order.userId?Math.floor(order.total*0.03):0;
  if(earned&&order.userId)await tx.user.update({where:{id:order.userId},data:{bonuses:{increment:earned}}});
  return tx.order.update({where:{id},data:{status:shipment.status,paymentStatus:shipment.paymentStatus,bonusesEarned:earned||order.bonusesEarned,...(shipment.trackingNumber?{trackingNumber:shipment.trackingNumber}:{}),events:{create:{status:shipment.status,message:shipment.message}}},include:orderInclude});
 });
}
export async function repeatOrder(id:string,user:OrderActor,cartId:string){
 const order=await getOrder(id,user);
 await db.$transaction(async tx=>{
  const cart=await tx.cart.findUniqueOrThrow({where:{id:cartId}});
  await lock(tx,cart.userId?`user:${cart.userId}`:`guest:${cart.guestToken}`);
  for(const item of order.items){
   const v=await tx.variant.findUnique({where:{id:item.variantId},include:{product:true}});
   if(!v||!v.active||!v.product.active)throw new ApiError(`Товар больше не продаётся: ${item.name}`,409);
   const current=await tx.cartItem.findUnique({where:{cartId_variantId:{cartId,variantId:v.id}}});
   const quantity=item.quantity+(current?.quantity??0);
   if(quantity>v.stock||quantity>99)throw new ApiError(`Недостаточный остаток: ${item.name}`,409);
   await tx.cartItem.upsert({where:{cartId_variantId:{cartId,variantId:v.id}},create:{cartId,variantId:v.id,quantity},update:{quantity}});
  }
 });return cartView(cartId);
}
