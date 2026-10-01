import {publicReviewWhere} from './review-visibility';
import {NextRequest,NextResponse} from 'next/server';
import {randomBytes} from 'node:crypto';
import {z,ZodError} from 'zod';
import {auth} from './auth';
import {db} from './db';
import {ApiError,addressSchema,assertStaff} from './validation';
import {catalog,product} from './catalog';
import {admin} from './admin';
import {upload} from './storage';
import {resolveCart,cartView,mutateCart,checkout,getOrder,payment,cancelOrder,repeatOrder,transitionOrder,orderInclude,productView,lock,guestHash,claimGuestOrders,orderView,genuineReviews} from './commerce';
export async function handle(req:NextRequest){
 let newGuest:string|undefined,newOrderGuest:string|undefined;
 try{
  const path=new URL(req.url).pathname.replace(/^\/api\//,'').split('/').map(decodeURIComponent),method=req.method;
  if(method!=='GET'&&method!=='HEAD'){
   const origin=req.headers.get('origin');
   if(origin&&origin!==new URL(process.env.BETTER_AUTH_URL??req.url).origin)throw new ApiError('Недопустимый источник запроса',403);
   if(Number(req.headers.get('content-length')??0)>6*1024*1024)throw new ApiError('Запрос слишком большой',413);
  }
  const session=await auth.api.getSession({headers:req.headers});
  const user=session?await db.user.findUnique({where:{id:session.user.id}}):null;
  const requireUser=()=>{if(!user)throw new ApiError('Войдите в аккаунт',401);return user;};
  const token=req.cookies.get('ve-cart')?.value;
  let guestToken=token&&/^[a-f0-9]{48}$/.test(token)?token:undefined;
  const orderToken=req.cookies.get('ve-orders')?.value;
  const validOrderToken=orderToken&&/^[a-f0-9]{64}$/.test(orderToken)?orderToken:undefined;
  // Only cart/checkout initializes this cookie, avoiding concurrent catalog/profile responses overwriting it.
  const capability=validOrderToken??(['cart','checkout'].includes(path[0])?(newOrderGuest=randomBytes(32).toString('hex')):undefined);
  const accessHash=capability?guestHash(capability):undefined;
  if(user&&accessHash)await claimGuestOrders(user,accessHash);
  const actor=user??(accessHash?{guestHash:accessHash}:null);
  const requireActor=()=>{if(!actor)throw new ApiError('Заказ недоступен в этом браузере',401);return actor;};
  const getCart=()=>{
   // Only operations that actually resolve a basket may initialize its cookie.
   guestToken??=(newGuest=randomBytes(24).toString('hex'));
   return resolveCart(user?.id,guestToken);
  };
  let body:any={};
  if(method!=='GET'&&method!=='HEAD'&&!req.headers.get('content-type')?.includes('multipart/form-data')){try{body=await req.json();}catch{throw new ApiError('Ожидается JSON');}}
  let result:unknown;
  const resource=path[0];
  if(resource==='catalog'&&method==='GET')result=await catalog(new URL(req.url).searchParams);
  else if(resource==='products'&&path[1]&&method==='GET')result=await product(path[1]);
  else if(resource==='cart'){
   const cartId=await getCart();result=method==='GET'?await cartView(cartId):await mutateCart(cartId,method,body);
  }
  else if(resource==='favorites'){
   const u=requireUser();
   if(method==='POST'){const productId=z.string().parse(body.productId);await db.favorite.upsert({where:{userId_productId:{userId:u.id,productId}},create:{userId:u.id,productId},update:{}});}
   if(method==='DELETE')await db.favorite.deleteMany({where:{userId:u.id,productId:z.string().parse(body.productId)}});
   result=(await db.favorite.findMany({where:{userId:u.id},include:{product:{include:{variants:true,reviews:genuineReviews}}}})).filter(f=>f.product.active).map(f=>productView(f.product));
  }
  else if(resource==='guest-checkout'&&method==='GET'){
   const last=accessHash?await db.order.findFirst({where:{userId:null,guestAccessHash:accessHash},orderBy:{createdAt:'desc'}}):null;
   result={contact:last?(last.address as any).contact:null};
  }
  else if(resource==='checkout'&&method==='POST'){await getCart();result=orderView(await checkout(user?.id,body,{cartToken:guestToken!,accessHash:accessHash!}));}
  else if(resource==='orders'){
   const u=requireActor(),id=path[1],action=path[2];
   if(!id&&method==='GET')result=await db.order.findMany({where:'id' in u?{userId:u.id}:{userId:null,guestAccessHash:u.guestHash},include:orderInclude,orderBy:{createdAt:'desc'}});
   else if(id&&method==='GET')result=await getOrder(id,u);
   else if(id&&method==='POST'){
    if(action==='payment')result=await payment(id,u,String(body.result??'success'),String(body.eventId??''));
    else if(action==='cancel')result=await cancelOrder(id,u);
    else if(action==='repeat')result=await repeatOrder(id,u,await getCart());
    else if(action==='shipping'){const staff=requireUser();assertStaff(staff);const o=await getOrder(id,staff);result=await transitionOrder(id,o.status==='PROCESSING'?'SHIPPED':'DELIVERED',staff,true);}
    else throw new ApiError('Операция не найдена',404);
   }else throw new ApiError('Метод не поддерживается',405);
   if(action!=='repeat')result=Array.isArray(result)?result.map(orderView):orderView(result);
  }
  else if(resource==='profile'){
   const u=requireUser();
   if(method==='PATCH'){
    const input=z.object({name:z.string().min(2).max(100).optional(),phone:z.string().max(30).optional(),settings:z.object({newsletter:z.boolean().optional(),sms:z.boolean().optional(),emailNotifications:z.boolean().optional()}).optional()}).parse(body);
    await db.user.update({where:{id:u.id},data:{...input,settings:input.settings?{...(u.settings as object),...input.settings}:undefined}});
   }
   result=await db.user.findUnique({where:{id:u.id},select:{id:true,name:true,email:true,phone:true,role:true,bonuses:true,settings:true,addresses:true}});
  }
  else if(resource==='addresses'){
   const u=requireUser();
   if(method==='GET')result=await db.address.findMany({where:{userId:u.id},orderBy:{isDefault:'desc'}});
   else if(method==='DELETE'){const r=await db.address.deleteMany({where:{id:z.string().parse(body.id),userId:u.id}});if(!r.count)throw new ApiError('Адрес не найден',404);result={ok:true};}
   else if(method==='POST'||method==='PATCH'){
    const data=addressSchema.parse(body);
    result=await db.$transaction(async tx=>{
     await lock(tx,`user:${u.id}`);
     if(data.isDefault)await tx.address.updateMany({where:{userId:u.id},data:{isDefault:false}});
     if(method==='PATCH'){
      const existing=await tx.address.findFirst({where:{id:z.string().parse(body.id),userId:u.id}});if(!existing)throw new ApiError('Адрес не найден',404);
      return tx.address.update({where:{id:existing.id},data});
     }
     return tx.address.create({data:{...data,userId:u.id}});
    });
   }else throw new ApiError('Метод не поддерживается',405);
  }
  else if(resource==='reviews'||resource==='questions'){
   const productId=new URL(req.url).searchParams.get('productId');
   if(method==='GET')result=resource==='reviews'?await db.review.findMany({where:{...(productId?{productId}:{}),...publicReviewWhere()},orderBy:{createdAt:'desc'},take:100}):await db.question.findMany({where:{...(productId?{productId}:{}),status:'APPROVED'},orderBy:{createdAt:'desc'},take:100});
   else if(method==='POST'){
    const u=requireUser();
    const common=z.object({productId:z.string().min(1),text:z.string().min(5).max(5000)}).parse(body);
    if(resource==='reviews')result=await db.review.create({data:{...common,...z.object({rating:z.number().int().min(1).max(5),title:z.string().min(2).max(200)}).parse(body),userId:u.id,author:u.name}});
    else result=await db.question.create({data:{...common,userId:u.id,author:u.name}});
   }else throw new ApiError('Метод не поддерживается',405);
  }
  else if(resource==='support'){
   const u=requireUser();
   if(method==='GET')result=await db.ticket.findMany({where:{userId:u.id},orderBy:{createdAt:'desc'}});
   else if(method==='POST'){const data=z.object({subject:z.string().min(3).max(200),message:z.string().min(5).max(5000)}).parse(body);result=await db.ticket.create({data:{userId:u.id,subject:data.subject,messages:[{text:data.message,staff:false,createdAt:new Date().toISOString()}]}});}
   else if(method==='PATCH'){
    const data=z.object({id:z.string(),message:z.string().min(1).max(5000)}).parse(body);
    result=await db.$transaction(async tx=>{await lock(tx,`ticket:${data.id}`);const ticket=await tx.ticket.findFirst({where:{id:data.id,userId:u.id}});if(!ticket)throw new ApiError('Обращение не найдено',404);return tx.ticket.update({where:{id:ticket.id},data:{status:'OPEN',messages:[...(ticket.messages as any[]),{text:data.message,staff:false,createdAt:new Date().toISOString()}]}});});
   }else throw new ApiError('Метод не поддерживается',405);
  }
  else if(resource==='subscribe'&&method==='POST'){
   const email=z.string().email().max(254).parse(body.email).toLowerCase();await db.subscription.upsert({where:{email},create:{email},update:{}});result={ok:true};
  }
  else if(resource==='admin'){
   const u=requireUser();assertStaff(u);
   if(path[1]==='upload'&&method==='POST'){const data=await req.formData();const file=data.get('file');if(!(file instanceof File))throw new ApiError('Файл не выбран');result=await upload(file);}
   else result=await admin(path[1],method,body,u);
  }
  else throw new ApiError('Маршрут не найден',404);
  const response=NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
  if(newGuest)response.cookies.set('ve-cart',newGuest,{httpOnly:true,sameSite:'lax',secure:process.env.BETTER_AUTH_URL?.startsWith('https://'),path:'/',maxAge:60*60*24*30});
  if(newOrderGuest)response.cookies.set('ve-orders',newOrderGuest,{httpOnly:true,sameSite:'lax',secure:process.env.BETTER_AUTH_URL?.startsWith('https://'),path:'/',maxAge:60*60*24*365});
  return response;
 }catch(e:any){
  if(e instanceof ApiError)return NextResponse.json({error:e.message},{status:e.status});
  if(e instanceof ZodError)return NextResponse.json({error:e.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')},{status:400});
  if(e.code==='P2002')return NextResponse.json({error:'Запись с такими данными уже существует'},{status:409});
  if(e.code==='P2025'||e.code==='P2003')return NextResponse.json({error:'Связанная запись не найдена или используется'},{status:409});
  console.error('[store-api]',e);return NextResponse.json({error:'Не удалось выполнить запрос'},{status:500});
 }
}
