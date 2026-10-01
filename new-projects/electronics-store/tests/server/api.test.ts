import 'dotenv/config';
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {NextRequest} from 'next/server';
import {handle} from '../../src/server/api';
import {auth} from '../../src/server/auth';
import {db} from '../../src/server/db';
const email=`http-${randomUUID()}@integration.local`;
const fixtureKey=`http-fixture-${randomUUID()}`;
let cookie='',userId='',guestCookie='',variantId='',productId='';
async function request(path:string,method='GET',body?:unknown,cookies=cookie,origin='http://localhost:3210'){
 const headers:Record<string,string>={origin};if(cookies)headers.cookie=cookies;if(body!==undefined)headers['content-type']='application/json';
 return handle(new NextRequest(`http://localhost:3210/api/${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}));
}
beforeAll(async()=>{
 if(process.env.TEST_MODE!=='true'||!process.env.DATABASE_URL?.includes('55435'))throw new Error('Isolated test database required');
 const registered=await auth.api.signUpEmail({body:{name:'HTTP Test Buyer',email,password:'IntegrationPass123!'}});userId=registered.user.id;
 const response=await auth.handler(new Request('http://localhost:3210/api/auth/sign-in/email',{method:'POST',headers:{'content-type':'application/json',origin:'http://localhost:3210'},body:JSON.stringify({email,password:'IntegrationPass123!'})}));
 expect(response.status).toBe(200);cookie=response.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
 await db.brand.create({data:{name:fixtureKey}});await db.category.create({data:{slug:fixtureKey,name:'HTTP fixture'}});
 const p=await db.product.create({data:{slug:fixtureKey,name:'HTTP fixture product',brand:fixtureKey,category:fixtureKey,description:'Isolated API fixture',images:['/test.png'],features:[],inBox:[],variants:{create:{sku:fixtureKey,color:'Black',storage:'128',price:10000,stock:20}}},include:{variants:true}});
 variantId=p.variants[0].id;productId=p.id;
});
afterAll(async()=>{
 await db.review.deleteMany({where:{userId}});await db.question.deleteMany({where:{userId}});await db.ticket.deleteMany({where:{userId}});await db.user.deleteMany({where:{id:userId}});
 await db.product.deleteMany({where:{id:productId}});await db.category.deleteMany({where:{slug:fixtureKey}});await db.brand.deleteMany({where:{name:fixtureKey}});await db.$disconnect();
});
describe('HTTP API session and input boundaries',()=>{
 it('enforces authentication and same-origin mutations',async()=>{
  expect((await request('profile','GET',undefined,'')).status).toBe(401);
  expect((await request('cart','POST',{variantId,quantity:1},'','https://evil.example')).status).toBe(403);
  expect((await request('admin/orders')).status).toBe(403);
 });
 it('does not initialize cart or order cookies on unrelated public reads',async()=>{
  for(const path of ['catalog',`products/${fixtureKey}`,'guest-checkout']){
   const response=await request(path,'GET',undefined,'');expect(response.status).toBe(200);
   expect(response.headers.getSetCookie().some(c=>/^ve-(cart|orders)=/.test(c))).toBe(false);
  }
 });
 it('persists a HttpOnly guest basket and merges it upon authenticated request',async()=>{
  const added=await request('cart','POST',{variantId,quantity:1},'');expect(added.status).toBe(200);
  expect(added.headers.get('set-cookie')).toContain('HttpOnly');
  expect(added.headers.getSetCookie().some(c=>/^ve-cart=[a-f0-9]{48};/.test(c))).toBe(true);
  expect(added.headers.getSetCookie().some(c=>/^ve-orders=[a-f0-9]{64};/.test(c))).toBe(true);guestCookie=added.headers.get('set-cookie')!.split(';')[0];
  const merged=await request('cart','GET',undefined,`${cookie}; ${guestCookie}`);expect(merged.status).toBe(200);
  expect((await merged.json()).items).toHaveLength(1);
 });
 it('prevents privilege and bonus escalation through profile fields',async()=>{
  const res=await request('profile','PATCH',{name:'Updated Buyer',role:'ADMIN',bonuses:999999,settings:{newsletter:true}});expect(res.status).toBe(200);
  const profile=await res.json();expect(profile.role).toBe('CUSTOMER');expect(profile.bonuses).toBe(0);expect(profile.settings.newsletter).toBe(true);
 });
 it('persists and guards own address edits',async()=>{
  const res=await request('addresses','POST',{name:'Test Buyer',phone:'+79991234567',city:'Москва',street:'ул. Тестовая 1',isDefault:true});expect(res.status).toBe(200);
  const address=await res.json();expect((await request('addresses','GET')).status).toBe(200);
  expect((await request('addresses','PATCH',{...address,id:'unknown'})).status).toBe(404);
  expect((await request('addresses','DELETE',{id:address.id})).status).toBe(200);
 });
 it('rejects malformed catalog parameters and returns approved product content',async()=>{
  for(const query of ['page=1.5','page=NaN','limit=1000','min=abc','rating=6'])expect((await request(`catalog?${query}`)).status).toBe(400);
  const p=await db.product.findUniqueOrThrow({where:{id:productId}});const res=await request(`products/${p.slug}`);expect(res.status).toBe(200);
  const json=await res.json();expect(json.variants.length).toBeGreaterThan(0);expect(Array.isArray(json.reviews)).toBe(true);expect(Array.isArray(json.questions)).toBe(true);
 });
 it('creates moderated reviews/questions and persists support conversation',async()=>{
  const r=await request('reviews','POST',{productId,rating:5,title:'Test review',text:'This is an integration test review.'});expect((await r.json()).status).toBe('PENDING');
  const q=await request('questions','POST',{productId,text:'Does the test question persist?'});expect((await q.json()).status).toBe('PENDING');
  const t=await request('support','POST',{subject:'Integration ticket',message:'Please test this support request.'});const ticket=await t.json();
  const reply=await request('support','PATCH',{id:ticket.id,message:'Follow-up message'});expect((await reply.json()).messages).toHaveLength(2);
 });
 it('makes favorites idempotent',async()=>{
  await request('favorites','POST',{productId});const res=await request('favorites','POST',{productId});expect((await res.json())).toHaveLength(1);
  expect((await request('favorites','DELETE',{productId})).status).toBe(200);
 });
});
