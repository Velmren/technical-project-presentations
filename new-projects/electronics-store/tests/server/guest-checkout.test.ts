import 'dotenv/config';
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {NextRequest} from 'next/server';
import {handle} from '../../src/server/api';
import {auth} from '../../src/server/auth';
import {db} from '../../src/server/db';
import {guestHash,transitionOrder} from '../../src/server/commerce';

const key=`guest-integration-${randomUUID()}`;
const users:string[]=[],orders:string[]=[],carts:string[]=[];
let variantId='',productId='';
const contact={name:'Guest Buyer',email:`${key}@integration.local`,phone:'+79991234567'};
const address={name:contact.name,phone:contact.phone,city:'Москва',street:'Тверская 12',postalCode:'125009'};
async function request(path:string,method='GET',body?:unknown,cookie=''){
 return handle(new NextRequest(`http://localhost:3210/api/${path}`,{method,headers:{origin:'http://localhost:3210',cookie,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}));
}
async function basket(){
 const response=await request('cart','POST',{variantId,quantity:1});expect(response.status).toBe(200);
 const data=await response.json();carts.push(data.id);
 const cookies=response.headers.getSetCookie();
 expect(cookies.some(c=>c.startsWith('ve-orders=')&&c.includes('HttpOnly')&&c.includes('SameSite=lax'))).toBe(true);
 return cookies.map(c=>c.split(';')[0]).join('; ');
}
async function place(cookie:string,overrides:Record<string,unknown>={}){
 const response=await request('checkout','POST',{idempotencyKey:randomUUID(),deliveryMethod:'courier',paymentMethod:'card',contact,address,...overrides},cookie);
 const order=await response.json();if(response.ok)orders.push(order.id);return {response,order};
}
async function account(email:string){
 // Fixture creation uses the auth API directly so signup HTTP rate limits stay enabled for real clients.
 const response=await auth.api.signUpEmail({body:{name:'Guest Account',email,password:'GuestIntegration123!'},asResponse:true});
 expect(response.status).toBe(200);const data=await response.json();users.push(data.user.id);
 return {id:data.user.id,cookie:response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')};
}
beforeAll(async()=>{
 if(process.env.TEST_MODE!=='true'||!process.env.DATABASE_URL?.includes('55435'))throw new Error('Dedicated database on 55435 required');
 await db.brand.create({data:{name:key}});await db.category.create({data:{slug:key,name:'Guest integration'}});
 const p=await db.product.create({data:{slug:key,name:'Guest fixture',brand:key,category:key,description:'Integration fixture',images:['/fallback.png'],features:[],inBox:[],variants:{create:{sku:key,color:'Black',price:12000,stock:30,images:['/variant.png']}}},include:{variants:true}});
 productId=p.id;variantId=p.variants[0].id;
});
afterAll(async()=>{
 await db.order.deleteMany({where:{id:{in:orders}}});await db.user.deleteMany({where:{id:{in:users}}});await db.cart.deleteMany({where:{id:{in:carts}}});
 await db.product.deleteMany({where:{id:productId}});await db.category.deleteMany({where:{slug:key}});await db.brand.deleteMany({where:{name:key}});await db.$disconnect();
});
describe('guest checkout capability boundary',()=>{
 it('persists contact/address and variant image without account and never exposes its access hash',async()=>{
  const cookie=await basket(),{response,order}=await place(cookie);expect(response.status).toBe(200);
  expect(order.isGuest).toBe(true);expect(order.userId).toBeNull();expect(order.address.contact).toEqual(contact);expect(order.address.street).toBe(address.street);expect(order.items[0].image).toBe('/variant.png');
  expect(order.guestAccessHash).toBeUndefined();expect(order.checkoutScope).toBeUndefined();
  const stored=await db.order.findUniqueOrThrow({where:{id:order.id}});const secret=cookie.match(/ve-orders=([a-f0-9]+)/)![1];expect(secret).toHaveLength(64);expect(stored.guestAccessHash).toBe(guestHash(secret));
  expect((await (await request('guest-checkout','GET',undefined,cookie)).json()).contact).toEqual(contact);
  expect((await request(`orders/${order.id}`)).status).toBe(401);
  const stranger=await basket();expect((await request(`orders/${order.id}`,'GET',undefined,stranger)).status).toBe(403);
  expect((await request(`orders/${order.id}/payment`,'POST',{eventId:randomUUID()},stranger)).status).toBe(403);
  expect((await request(`orders/${order.id}/cancel`,'POST',{},stranger)).status).toBe(403);
  expect((await request(`orders/${order.id}/shipping`,'POST',{},cookie)).status).toBe(401);
 });
 it('initializes order capability at checkout for an existing legacy guest basket',async()=>{
  const cookie=await basket(),legacyCookie=cookie.split('; ').find(c=>c.startsWith('ve-cart='))!;
  const {response,order}=await place(legacyCookie);expect(response.status).toBe(200);
  const issued=response.headers.getSetCookie();expect(issued.some(c=>/^ve-orders=[a-f0-9]{64};/.test(c)&&c.includes('HttpOnly'))).toBe(true);
  expect(issued.some(c=>c.startsWith('ve-cart='))).toBe(false);
  expect((await request(`orders/${order.id}`,'GET',undefined,`${legacyCookie}; ${issued.map(c=>c.split(';')[0]).join('; ')}`)).status).toBe(200);
 });
 it('serializes concurrent retries, takes stock once and returns stock once on cancellation',async()=>{
  const cookie=await basket(),before=(await db.variant.findUniqueOrThrow({where:{id:variantId}})).stock,idempotencyKey=randomUUID();
  const [a,b]=await Promise.all([place(cookie,{idempotencyKey}),place(cookie,{idempotencyKey})]);expect(a.response.status).toBe(200);expect(b.order.id).toBe(a.order.id);
  expect((await db.variant.findUniqueOrThrow({where:{id:variantId}})).stock).toBe(before-1);
  const eventId=randomUUID();for(let i=0;i<2;i++)expect((await request(`orders/${a.order.id}/payment`,'POST',{eventId},cookie)).status).toBe(200);
  const cancel=()=>request(`orders/${a.order.id}/cancel`,'POST',{},cookie);const cancelled=await Promise.all([cancel(),cancel()]);expect(cancelled.every(r=>r.status===200)).toBe(true);
  expect((await db.variant.findUniqueOrThrow({where:{id:variantId}})).stock).toBe(before);expect(await db.paymentEvent.count({where:{orderId:a.order.id}})).toBe(1);
 });
 it('requires contacts and rejects account-only benefits for guests',async()=>{
  const cookie=await basket();expect((await place(cookie,{contact:undefined})).response.status).toBe(400);expect((await place(cookie,{useBonuses:100})).response.status).toBe(401);
  expect((await place(cookie,{addressId:'guessed-address'})).response.status).toBe(401);
 });
 it('allows only one guest to reserve the final unit',async()=>{
  const first=await basket(),second=await basket(),before=(await db.variant.findUniqueOrThrow({where:{id:variantId}})).stock;
  await db.variant.update({where:{id:variantId},data:{stock:1}});
  const results=await Promise.all([place(first),place(second)]);expect(results.filter(r=>r.response.status===200)).toHaveLength(1);expect(results.filter(r=>r.response.status===409)).toHaveLength(1);
  expect((await db.variant.findUniqueOrThrow({where:{id:variantId}})).stock).toBe(0);
  await db.variant.update({where:{id:variantId},data:{stock:before}});
 });
 it('fulfills guest cash orders without issuing account bonuses',async()=>{
  const cookie=await basket(),{order}=await place(cookie,{paymentMethod:'cash'}),staff={id:'integration-staff',role:'STAFF'};
  await transitionOrder(order.id,'SHIPPED',staff);const delivered=await transitionOrder(order.id,'DELIVERED',staff);
  expect(delivered.paymentStatus).toBe('PAID');expect(delivered.userId).toBeNull();expect(delivered.bonusesEarned).toBe(0);
 });
 it('claims only with both browser capability and matching authenticated email, revoking guest access',async()=>{
  const cookie=await basket(),idempotencyKey=randomUUID(),{order}=await place(cookie,{idempotencyKey}),owner=await account(contact.email),stranger=await account(`other-${key}@integration.local`);
  await request('profile','GET',undefined,owner.cookie);expect((await db.order.findUniqueOrThrow({where:{id:order.id}})).userId).toBeNull();
  await request('profile','GET',undefined,`${stranger.cookie}; ${cookie}`);expect((await db.order.findUniqueOrThrow({where:{id:order.id}})).userId).toBeNull();
  expect((await request(`orders/${order.id}`,'GET',undefined,owner.cookie)).status).toBe(403);
  const [claimed,concurrent]=await Promise.all([request(`orders/${order.id}`,'GET',undefined,`${owner.cookie}; ${cookie}`),request('profile','GET',undefined,`${owner.cookie}; ${cookie}`)]);expect(concurrent.status).toBe(200);expect(claimed.status).toBe(200);expect((await claimed.json()).isGuest).toBe(false);
  expect((await db.order.findUniqueOrThrow({where:{id:order.id}})).guestAccessHash).toBeNull();
  const profile=await (await request('profile','GET',undefined,owner.cookie)).json();expect(profile.phone).toBe(contact.phone);expect(profile.addresses).toHaveLength(1);expect(profile.addresses[0]).toMatchObject({...address,isDefault:true});
  expect((await request(`orders/${order.id}`,'GET',undefined,cookie)).status).toBe(403);
  expect((await request(`orders/${order.id}`,'GET',undefined,owner.cookie)).status).toBe(200);
  const own=await (await request('orders','GET',undefined,owner.cookie)).json();expect(own.some((o:any)=>o.id===order.id)).toBe(true);
  const replay=await place(`${owner.cookie}; ${cookie}`,{idempotencyKey});expect(replay.response.status).toBe(200);expect(replay.order.id).toBe(order.id);
  expect((await place(cookie,{idempotencyKey})).response.status).toBe(403);
 });
 it('preserves an existing profile phone, deduplicates courier addresses and excludes pickup points',async()=>{
  const email=`saved-profile-${key}@integration.local`,buyer=await account(email),phone='+7 9992223344';
  await db.user.update({where:{id:buyer.id},data:{phone}});
  const cookie=await basket();await place(cookie,{contact:{...contact,email,phone:'+79994445566'}});
  await request('cart','POST',{variantId,quantity:1},cookie);await place(cookie,{contact:{...contact,email,phone:'+79997778899'}});
  await request('cart','POST',{variantId,quantity:1},cookie);await place(cookie,{deliveryMethod:'pickup',contact:{...contact,email},address:{...address,street:'Пункт выдачи 88'},pickupPoint:'Пункт выдачи 88'});
  const signed=`${buyer.cookie}; ${cookie}`;
  await Promise.all([request('profile','GET',undefined,signed),request('profile','GET',undefined,signed)]);
  const profile=await (await request('profile','GET',undefined,signed)).json();expect(profile.phone).toBe(phone);expect(profile.addresses).toHaveLength(1);expect(profile.addresses[0].street).toBe(address.street);
 });
 it('uses the latest matching contact phone verbatim for a blank profile',async()=>{
  const email=`latest-phone-${key}@integration.local`,buyer=await account(email),cookie=await basket();
  await place(cookie,{contact:{...contact,email,phone:'+79990001122'}});
  await request('cart','POST',{variantId,quantity:1},cookie);await place(cookie,{contact:{...contact,email,phone:'+7 9992223344'}});
  const profile=await (await request('profile','GET',undefined,`${buyer.cookie}; ${cookie}`)).json();expect(profile.phone).toBe('+7 9992223344');expect(profile.addresses).toHaveLength(1);
 });
 it('excludes seeded testimonials from public reviews and rating aggregates',async()=>{
  const author=await account(`review-${key}@integration.local`);
  await db.review.createMany({data:[{userId:author.id,productId,author:'Fixture',rating:5,title:'Seed',text:'Fixture testimonial',isDemo:true,status:'APPROVED'},{userId:author.id,productId,author:'Buyer',rating:3,title:'Real',text:'Customer review',isDemo:false,status:'APPROVED'}]});
  const product=await (await request(`products/${key}`)).json();expect(product.rating).toBe(3);expect(product.reviewCount).toBe(1);expect(product.reviews).toHaveLength(1);
  const catalog=await (await request(`catalog?category=${key}`)).json();expect(catalog.products[0].rating).toBe(3);expect(catalog.products[0].reviewCount).toBe(1);
  const reviews=await (await request(`reviews?productId=${productId}`)).json();expect(reviews).toHaveLength(1);expect(reviews[0].isDemo).toBe(false);
  await db.review.deleteMany({where:{productId}});
 });
});
