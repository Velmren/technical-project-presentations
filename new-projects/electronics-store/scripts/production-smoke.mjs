import 'dotenv/config';
import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const output='E:/Astra/2026-09-26/realtime-voice-chat/outputs/electronics-store/revision';
const password=process.env.DEMO_PASSWORD;
if(!password){console.error('DEMO_PASSWORD is not set (see .env.example); the smoke check signs in as the demo buyer.');process.exit(1);}
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];const results=[];page.on('pageerror',e=>errors.push(e.message));
for(const route of ['/','/catalog','/category/smartphones','/search?q=iPhone','/product/iphone-15-pro-max','/compare','/favorites','/cart','/checkout','/service/delivery','/service/payment','/service/warranty','/service/returns','/service/about','/service/contacts','/auth']){
 const response=await page.goto(`http://localhost:3210${route}`);await page.waitForLoadState('networkidle');
 const broken=await page.locator('img').evaluateAll(images=>images.filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src));
 results.push({route,status:response.status(),brokenImages:broken});
 if(route==='/')await page.screenshot({path:`${output}/preview.png`});
}
await page.getByLabel('Электронная почта',{exact:true}).fill('buyer@velmren.local');await page.getByLabel('Пароль',{exact:true}).fill(password);await page.getByRole('button',{name:'Войти',exact:true}).last().click();await page.waitForURL('**/account/orders');await page.locator('.commerce-account-order').first().waitFor();
const orders=await page.request.get('http://localhost:3210/api/orders').then(r=>r.json());
const response=await page.goto(`http://localhost:3210/orders/${orders[0].id}`);await page.locator('.commerce-order-columns').waitFor();results.push({route:'/orders/[id]',status:response.status(),number:orders[0].number});
await page.goto('http://localhost:3210/');await page.waitForLoadState('networkidle');const report={at:new Date().toISOString(),mode:'next start',results,pageErrors:errors,pass:results.every(r=>r.status===200&&!r.brokenImages?.length)&&!errors.length};await writeFile(`${output}/production-smoke.json`,JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
