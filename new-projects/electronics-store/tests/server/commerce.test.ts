import 'dotenv/config';
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {db} from '../../src/server/db';
import {checkout,resolveCart,mutateCart,cartView,payment,cancelOrder,getOrder,transitionOrder,repeatOrder} from '../../src/server/commerce';
import {admin} from '../../src/server/admin';
import {catalog,product} from '../../src/server/catalog';
import {TestPaymentProvider} from '../../src/server/providers';
const run=`integration-${randomUUID()}`;
const users:string[]=[];const products:string[]=[];const promos:string[]=[];
let brand:string;let category:string;
async function fixture(stock=5){
 const suffix=randomUUID();const id=`${run}-${suffix}`;
 await db.user.create({data:{id,name:'Integration Buyer',email:`${suffix}@integration.local`}});users.push(id);
 const p=await db.product.create({data:{id,slug:id,name:'Test device',brand,category,description:'Test fixture',images:['/test.png'],features:[],inBox:[],variants:{create:{id,sku:id,color:'Black',storage:'128',price:10000,stock}}}});products.push(p.id);
 const cartId=await resolveCart(id);await mutateCart(cartId,'POST',{variantId:id,quantity:1});
 return {id,cartId,user:{id,role:'CUSTOMER'},input:{idempotencyKey:randomUUID(),deliveryMethod:'pickup' as const,paymentMethod:'card' as const,useBonuses:0}};
}
beforeAll(async()=>{
 if(process.env.TEST_MODE!=='true'||!process.env.DATABASE_URL?.includes('55435'))throw new Error('Integration tests require isolated local database on port 55435');
 brand=run;category=run;await db.brand.create({data:{name:brand}});await db.category.create({data:{slug:category,name:'Integration'}});
});
afterAll(async()=>{
 await db.order.deleteMany({where:{userId:{in:users}}});
 await db.user.deleteMany({where:{id:{in:users}}});
 await db.product.deleteMany({where:{id:{in:products}}});
 await db.promo.deleteMany({where:{code:{in:promos}}});
 await db.brand.deleteMany({where:{name:brand}});await db.category.deleteMany({where:{slug:category}});await db.$disconnect();
});
describe('PostgreSQL commerce integrity',()=>{
 it('retires offers without selling them or rewriting historical orders and stock',async()=>{
  const f=await fixture(5),historical=await checkout(f.id,f.input);
  await mutateCart(f.cartId,'POST',{variantId:f.id,quantity:1});
  const replacement=await db.variant.create({data:{productId:f.id,sku:randomUUID(),color:'Verified silver',price:20000,stock:3,images:['/verified.png']}});
  await admin('variants','PATCH',{id:f.id,active:false},{id:'integration-staff',role:'STAFF'});
  expect((await db.variant.findUniqueOrThrow({where:{id:f.id}})).stock).toBe(4);
  const detail=await product(f.id);expect(detail.variants.map((v:any)=>v.id)).toEqual([replacement.id]);expect(detail.price).toBe(20000);expect(detail.stock).toBe(3);expect(detail.images).toEqual(['/verified.png']);
  const matching=await catalog(new URLSearchParams({category}));expect(matching.products.find(p=>p.id===f.id)?.selectedVariantId).toBe(replacement.id);
  expect((await cartView(f.cartId)).items[0].availabilityError).toContain('больше не продаётся');
  await expect(mutateCart(f.cartId,'POST',{variantId:f.id,quantity:1})).rejects.toMatchObject({status:409});
  await expect(mutateCart(f.cartId,'PATCH',{variantId:f.id,quantity:1})).rejects.toMatchObject({status:409});
  await expect(checkout(f.id,{...f.input,idempotencyKey:randomUUID()})).rejects.toMatchObject({status:409});
  await expect(repeatOrder(historical.id,f.user,f.cartId)).rejects.toMatchObject({status:409});
  expect((await getOrder(historical.id,f.user)).items[0]).toMatchObject({variantId:f.id,price:10000,image:'/test.png'});
  await cancelOrder(historical.id,f.user);expect((await db.variant.findUniqueOrThrow({where:{id:f.id}})).stock).toBe(5);
  expect((await db.variant.findUniqueOrThrow({where:{id:f.id}})).active).toBe(false);
  await mutateCart(f.cartId,'DELETE',{variantId:f.id});expect((await cartView(f.cartId)).items).toHaveLength(0);
  await db.variant.update({where:{id:replacement.id},data:{active:false}});expect((await product(f.id)).variants).toHaveLength(0);expect((await product(f.id)).stock).toBe(0);
  expect((await catalog(new URLSearchParams({category}))).products.some(p=>p.id===f.id)).toBe(false);
 });
 it('serializes identical concurrent checkout requests and decrements stock once',async()=>{
  const f=await fixture(2);
  const [a,b]=await Promise.all([checkout(f.id,f.input),checkout(f.id,f.input)]);
  expect(a.id).toBe(b.id);expect((await db.variant.findUniqueOrThrow({where:{id:f.id}})).stock).toBe(1);
  expect(a.total).toBe(10000);expect((await cartView(f.cartId)).items).toHaveLength(0);
 });
 it('allows only one buyer to buy the final item',async()=>{
  const a=await fixture(1),b=await fixture();
  await mutateCart(b.cartId,'DELETE',{});await mutateCart(b.cartId,'POST',{variantId:a.id,quantity:1});
  const results=await Promise.allSettled([checkout(a.id,a.input),checkout(b.id,b.input)]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
  expect((await db.variant.findUniqueOrThrow({where:{id:a.id}})).stock).toBe(0);
 });
 it('rolls back all stock decrements when a later item has no inventory',async()=>{
  const f=await fixture(),second=await fixture();
  await mutateCart(f.cartId,'POST',{variantId:second.id,quantity:1});
  await db.variant.update({where:{id:second.id},data:{stock:0}});
  await expect(checkout(f.id,f.input)).rejects.toThrow('Недостаточно');
  expect((await db.variant.findUniqueOrThrow({where:{id:f.id}})).stock).toBe(5);
  expect((await cartView(f.cartId)).items).toHaveLength(2);
 });
 it('uses server prices and validates promos, retaining immutable item snapshot',async()=>{
  const f=await fixture();
  const order=await checkout(f.id,{...f.input,...{total:1,price:1},contact:{name:'Тестовый покупатель',email:'buyer@test.local',phone:'+79991234567'},recipient:{name:'Другой получатель',phone:'+79991234568'},pickupPoint:'Москва — центр'});
  await db.variant.update({where:{id:f.id},data:{price:777}});
  expect((await getOrder(order.id,f.user)).items[0].price).toBe(10000);
  expect(order.total).toBe(10000);expect((order.address as any).recipient.name).toBe('Другой получатель');
 });
 it('supports failure/retry, deduplicates payment and returns paid stock exactly once',async()=>{
  const f=await fixture(2),o=await checkout(f.id,f.input);
  const eventId=randomUUID();expect((await payment(o.id,f.user,'failure',eventId)).paymentStatus).toBe('FAILED');
  expect((await payment(o.id,f.user,'failure',eventId)).paymentStatus).toBe('FAILED');
  const success=randomUUID();await payment(o.id,f.user,'success',success);await payment(o.id,f.user,'success',success);
  const [a,b]=await Promise.all([cancelOrder(o.id,f.user),cancelOrder(o.id,f.user)]);
  expect(a.paymentStatus).toBe('REFUNDED');expect(b.status).toBe('CANCELLED');
  expect((await db.variant.findUniqueOrThrow({where:{id:f.id}})).stock).toBe(2);
  expect(await db.paymentEvent.count({where:{orderId:o.id}})).toBe(2);
 });
 it('rejects unauthorized order reads/payments/cancellation and admin actions',async()=>{
  const f=await fixture(),o=await checkout(f.id,f.input),stranger={id:'stranger',role:'CUSTOMER'};
  await expect(getOrder(o.id,stranger)).rejects.toMatchObject({status:403});
  await expect(payment(o.id,stranger,'success',randomUUID())).rejects.toMatchObject({status:403});
  await expect(cancelOrder(o.id,stranger)).rejects.toMatchObject({status:403});
  await expect(admin('products','GET',{},stranger)).rejects.toMatchObject({status:403});
 });
 it('enforces fulfillment states and grants bonuses only once',async()=>{
  const f=await fixture(),o=await checkout(f.id,f.input);
  await expect(transitionOrder(o.id,'SHIPPED',f.user,true)).rejects.toMatchObject({status:409});
  await payment(o.id,f.user,'success',randomUUID());
  await transitionOrder(o.id,'SHIPPED',f.user,true);await transitionOrder(o.id,'DELIVERED',f.user,true);
  await expect(transitionOrder(o.id,'DELIVERED',f.user,true)).rejects.toMatchObject({status:409});
  expect((await db.user.findUniqueOrThrow({where:{id:f.id}})).bonuses).toBe(300);
  await expect(cancelOrder(o.id,f.user)).rejects.toMatchObject({status:409});
 });
 it('merges guest cart once into existing account basket',async()=>{
  const f=await fixture(),token=randomUUID(),guest=await resolveCart(undefined,token);
  await mutateCart(guest,'POST',{variantId:f.id,quantity:2});
  await Promise.all([resolveCart(f.id,token),resolveCart(f.id,token)]);
  expect((await cartView(f.cartId)).items[0].quantity).toBe(3);
  expect(await db.cart.findUnique({where:{guestToken:token}})).toBeNull();
 });
 it('rejects stale admin stock edits without applying accompanying price changes',async()=>{
  const f=await fixture(),staff={id:'integration-staff',role:'STAFF'};
  await checkout(f.id,f.input);
  await expect(admin('variants','PATCH',{id:f.id,stock:10},staff)).rejects.toThrow();
  await expect(admin('variants','PATCH',{id:f.id,stock:10,expectedStock:5,price:1},staff)).rejects.toMatchObject({status:409});
  expect(await db.variant.findUniqueOrThrow({where:{id:f.id}})).toMatchObject({stock:4,price:10000});
  await admin('variants','PATCH',{id:f.id,price:11000},staff);
  expect(await admin('variants','PATCH',{id:f.id,stock:8,expectedStock:4},staff)).toMatchObject({stock:8,price:11000});
 });
 it('fulfills cash orders unpaid and collects payment with one bonus credit on delivery',async()=>{
  const f=await fixture(),o=await checkout(f.id,{...f.input,paymentMethod:'cash'});
  expect(o).toMatchObject({status:'PROCESSING',paymentStatus:'PENDING'});
  const shipped=await transitionOrder(o.id,'SHIPPED',f.user,true);expect(shipped.paymentStatus).toBe('PENDING');
  const deliveries=await Promise.allSettled([transitionOrder(o.id,'DELIVERED',f.user,true),transitionOrder(o.id,'DELIVERED',f.user,true)]);
  expect(deliveries.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect(await getOrder(o.id,f.user)).toMatchObject({status:'DELIVERED',paymentStatus:'PAID',bonusesEarned:300});
  expect((await db.user.findUniqueOrThrow({where:{id:f.id}})).bonuses).toBe(300);
  const sbp=await fixture(),unpaid=await checkout(sbp.id,{...sbp.input,paymentMethod:'sbp'});
  await expect(transitionOrder(unpaid.id,'SHIPPED',sbp.user,true)).rejects.toMatchObject({status:409});
 });
 it('returns spent bonuses exactly once when cash or paid card orders are cancelled concurrently',async()=>{
  for(const method of ['cash','card'] as const){
   const f=await fixture();await db.user.update({where:{id:f.id},data:{bonuses:2500}});
   const o=await checkout(f.id,{...f.input,paymentMethod:method,useBonuses:2000});
   expect(o.bonusesSpent).toBe(2000);expect((await db.user.findUniqueOrThrow({where:{id:f.id}})).bonuses).toBe(500);
   if(method==='card')await payment(o.id,f.user,'success',randomUUID());
   await Promise.all([cancelOrder(o.id,f.user),cancelOrder(o.id,f.user)]);
   expect((await db.user.findUniqueOrThrow({where:{id:f.id}})).bonuses).toBe(2500);
   expect((await db.variant.findUniqueOrThrow({where:{id:f.id}})).stock).toBe(5);
  }
 });
 it('selects and sorts the matching variant rather than a cheaper nonmatching sibling',async()=>{
  const a=await fixture(),b=await fixture(),query=`Filtered-${randomUUID()}`;
  await db.product.updateMany({where:{id:{in:[a.id,b.id]}},data:{name:query}});
  await db.variant.update({where:{id:a.id},data:{stock:0,oldPrice:15000}});
  const selected=await db.variant.create({data:{productId:a.id,sku:randomUUID(),color:'Red',storage:'256',price:45000,oldPrice:50000,stock:2}});
  await db.variant.update({where:{id:b.id},data:{color:'Red',storage:'256',price:35000,oldPrice:40000,stock:4}});
  const result=await catalog(new URLSearchParams({q:query,category,min:'30000',storage:'256',color:'Red',inStock:'true',sale:'true',sort:'price-asc'}));
  expect(result.products.map(p=>p.id)).toEqual([b.id,a.id]);
  expect(result.products[1]).toMatchObject({selectedVariantId:selected.id,price:45000,oldPrice:50000,stock:2});
  expect(result.products[1].variants[0].id).toBe(selected.id);
 });
 it('preserves guest promo on merge, respects an account promo and revalidates eligibility',async()=>{
  const guestCode=`G${randomUUID().replaceAll('-','').toUpperCase()}`,ownCode=`U${randomUUID().replaceAll('-','').toUpperCase()}`;promos.push(guestCode,ownCode);
  await db.promo.createMany({data:[{code:guestCode,type:'PERCENT',value:10,maxDiscount:5000},{code:ownCode,type:'FIXED',value:500,maxDiscount:500}]});
  const f=await fixture(),token=randomUUID(),guest=await resolveCart(undefined,token);
  await mutateCart(guest,'POST',{variantId:f.id,quantity:1});await mutateCart(guest,'PATCH',{promoCode:guestCode});
  await resolveCart(f.id,token);expect(await cartView(f.cartId)).toMatchObject({promoCode:guestCode,discount:2000,promoError:null});
  await db.promo.update({where:{code:guestCode},data:{active:false}});
  const invalid=await cartView(f.cartId);expect(invalid.discount).toBe(0);expect(invalid.promoError).toBeTruthy();
  await expect(checkout(f.id,f.input)).rejects.toThrow('Промокод');
  await mutateCart(f.cartId,'PATCH',{promoCode:ownCode});
  await db.promo.update({where:{code:guestCode},data:{active:true}});
  const token2=randomUUID(),guest2=await resolveCart(undefined,token2);
  await mutateCart(guest2,'POST',{variantId:f.id,quantity:1});await mutateCart(guest2,'PATCH',{promoCode:guestCode});await resolveCart(f.id,token2);
  expect((await cartView(f.cartId)).promoCode).toBe(ownCode);
 });
 it('saves an address atomically once and deduplicates subsequent successful checkouts',async()=>{
  const f=await fixture(),address={name:'Тест Покупатель',phone:'+79991112233',city:'Москва',street:'Тестовая улица, 1'};
  const input={...f.input,deliveryMethod:'courier' as const,address,saveAddress:true};
  const [a,b]=await Promise.all([checkout(f.id,input),checkout(f.id,input)]);expect(a.id).toBe(b.id);
  expect(await db.address.count({where:{userId:f.id}})).toBe(1);
  await mutateCart(f.cartId,'POST',{variantId:f.id,quantity:1});await checkout(f.id,{...input,idempotencyKey:randomUUID()});
  expect(await db.address.count({where:{userId:f.id}})).toBe(1);
  const failed=await fixture();await db.variant.update({where:{id:failed.id},data:{stock:0}});
  await expect(checkout(failed.id,{...failed.input,deliveryMethod:'courier',address,saveAddress:true})).rejects.toThrow('Недостаточно');
  expect(await db.address.count({where:{userId:failed.id}})).toBe(0);
 });
 it('returns typed provider success, failure and repeated events, rejecting mismatched replay',async()=>{
  const provider=new TestPaymentProvider(),event={orderId:'typed-order',eventId:randomUUID(),result:'success' as const};
  expect((await provider.resolveEvent(event,null)).kind).toBe('success');
  expect((await provider.resolveEvent({...event,result:'failure'},null)).kind).toBe('failure');
  expect((await provider.resolveEvent(event,event)).kind).toBe('repeated');
  await expect(provider.resolveEvent({...event,result:'failure'},event)).rejects.toMatchObject({status:409});
 });
});
