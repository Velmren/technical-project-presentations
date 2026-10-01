import {test,expect} from '@playwright/test';
import {demoPassword} from './credentials';
const output='E:/Astra/2026-09-26/realtime-voice-chat/outputs/electronics-store/revision/screenshots';
test('Наведение показывает цвет временно, клик закрепляет; отзывы заполнены',async({page})=>{
 await page.goto('/product/iphone-15');const image=page.locator('.main-image-button img');await expect(image).toBeVisible();
 await page.getByRole('button',{name:'Цвет: Розовый',exact:true}).click();const pink=await image.getAttribute('src');
 const blue=page.getByRole('button',{name:'Цвет: Голубой',exact:true});await blue.hover();await expect(image).not.toHaveAttribute('src',pink!);await expect(blue).toHaveAttribute('aria-pressed','false');
 await page.locator('.product-purchase h1').hover();await expect(image).toHaveAttribute('src',pink!);
 await blue.click();await page.locator('.product-purchase h1').hover();await expect(blue).toHaveAttribute('aria-pressed','true');await expect(image).not.toHaveAttribute('src',pink!);
 await page.getByRole('tab',{name:/Отзывы/}).click();await expect(page.locator('.review-card')).toHaveCount(2);await page.screenshot({path:`${output}/16-populated-reviews.png`,fullPage:true,animations:'disabled'});
});
test('Избранное остаётся внутри кабинета и сохраняет боковое меню',async({page})=>{
 await page.goto('/auth');await page.getByLabel('Электронная почта',{exact:true}).fill('buyer@velmren.local');await page.getByLabel('Пароль',{exact:true}).fill(demoPassword());await page.getByRole('button',{name:'Войти',exact:true}).last().click();await expect(page).toHaveURL(/account\/orders/);
 await page.getByRole('navigation',{name:'Личный кабинет',exact:true}).getByRole('link',{name:'Избранное',exact:true}).click();await expect(page).toHaveURL(/account\/favorites/);await expect(page.locator('.commerce-account-sidebar')).toBeVisible();await expect(page.locator('.account-favorites h2').first()).toHaveText('Избранное');
 await page.screenshot({path:`${output}/17-account-favorites.png`,fullPage:true,animations:'disabled'});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 const orders=await page.request.get('/api/orders').then(r=>r.json());const unpaid=orders.find((o:any)=>o.status==='PENDING_PAYMENT'&&o.paymentMethod!=='cash');expect(unpaid).toBeTruthy();await page.goto(`/orders/${unpaid.id}`);await expect(page.locator('.order-payment-panel button')).toBeVisible();
 const spacing=await page.locator('.order-payment-panel').evaluate(el=>{const button=el.querySelector('button')!.getBoundingClientRect(),panel=el.getBoundingClientRect();return{left:button.left-panel.left,bottom:panel.bottom-button.bottom,margin:parseFloat(getComputedStyle(el).marginTop)}});expect(spacing.left).toBeGreaterThanOrEqual(23);expect(spacing.bottom).toBeGreaterThanOrEqual(23);expect(spacing.margin).toBeGreaterThanOrEqual(24);await page.screenshot({path:`${output}/18-order-payment-mobile.png`,fullPage:true,animations:'disabled'});
});
test('Favicon, SVG брендов и спокойная панель слайдера',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await expect(page.locator('.scene-phone')).toHaveAttribute('src','/media/hero-phone-v2.png');expect((await page.request.get('/favicon.ico')).ok()).toBeTruthy();await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute('href',/favicon|icon/);
 await page.getByRole('button',{name:'Приостановить автоматическую смену баннеров'}).click();await page.screenshot({path:`${output}/19-refined-hero.png`,animations:'disabled'});
 await page.goto('/search?sale=true');await expect(page.locator('.brand-logo img').first()).toBeVisible();expect(await page.locator('.brand-logo img').count()).toBeGreaterThanOrEqual(12);expect(await page.locator('.brand-pills').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBeTruthy();await page.screenshot({path:`${output}/20-brand-logos.png`,animations:'disabled'});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();expect(errors).toEqual([]);
});
