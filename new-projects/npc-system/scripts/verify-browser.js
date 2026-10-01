async page => {
 const output='E:/Astra/2026-09-26/realtime-voice-chat/outputs/portfolio-projects/npc-system/';
 const url='http://127.0.0.1:4187/projects/npc-system/';
 const key='velmren.north-harbor.v2';
 let checks=0;
 const check=(ok,name)=>{checks++;if(!ok)throw new Error(name);};
 const data=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
 const click=name=>page.getByRole('button',{name,exact:true}).click();
 await page.evaluate(k=>localStorage.removeItem(k),key);await page.reload();await page.setViewportSize({width:1440,height:900});
 await page.screenshot({path:output+'desktop.png',fullPage:true});
 await page.locator('.demo').screenshot({path:output+'thumbnail.png'});
 await click('Пока не готов');check((await data()).stage==='NEW','decline no transition');
 await click('Помогу гавани');check((await data()).stage==='SUPPLY','accept');
 await click('Ника Сигнальщик');check((await page.locator('#speech').innerText()).includes('три медных'),'inspection prerequisite dialogue');
 await click('Пойти к Льву');await click('Передать медный слиток');
 check((await page.locator('#feedback').innerText()).includes('нет меди'),'missing resource feedback');
 await page.screenshot({path:output+'missing-copper.png'});
 for(let i=0;i<3;i++)await page.getByRole('button',{name:'Взять один медный слиток для демонстрации'}).click();
 check(await page.locator('#gather').isDisabled(),'demo bag cap');
 await click('Передать медный слиток');await click('Передать медный слиток');
 check((await data()).copper===2&&(await data()).bag===1,'resources consumed exactly');
 await page.reload();check((await data()).copper===2&&(await data()).npc==='lev','partial save reload');
 check((await page.locator('#speech').innerText()).includes('2 из трёх'),'partial dialogue after reload');
 await click('Передать медный слиток');check((await data()).stage==='INSPECTION','supply done');
 await click('Пойти к Нике');await click('Проверить сигнал');
 check((await data()).stage==='RETURN','inspection');
 check(await page.locator('#scene-success').isVisible(),'scene feedback');
 await click('Вернуться к Маре');await click('Завершить задание · 1 изумруд');
 check((await data()).emerald===1&&(await data()).stage==='COMPLETE','reward');
 await page.reload();check((await data()).emerald===1,'reward survives reload');
 check(await page.getByRole('button',{name:'Завершить задание · 1 изумруд',exact:true}).count()===0,'repeat reward unavailable');
 await page.screenshot({path:output+'complete-desktop.png',fullPage:true});
 await page.locator('#reset').focus();await page.keyboard.press('Enter');check(await page.locator('dialog').isVisible(),'keyboard opens modal');
 await page.keyboard.press('Escape');check(!(await page.locator('dialog').isVisible())&&(await data()).stage==='COMPLETE','Escape preserves progress');
 await page.locator('#reset').click();await click('Продолжить задание');check((await data()).stage==='COMPLETE','cancel reset');
 await page.locator('#reset').click();await page.getByRole('button',{name:'Начать заново',exact:true}).last().click();check((await data()).stage==='NEW','confirmed reset');
 for(const width of [1440,1024,850,768,560,390]){
  await page.setViewportSize({width,height:844});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow '+width);
  check(await page.locator('.npc').count()===3,'roster intact '+width);
 }
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));
 await page.screenshot({path:output+'mobile.png',fullPage:true});
 await page.screenshot({path:output+'mobile-top.png'});
 await page.locator('#dialogue').scrollIntoViewIfNeeded();await page.screenshot({path:output+'mobile-dialogue.png'});
 await page.emulateMedia({reducedMotion:'reduce'});check(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior==='auto'),'reduced motion');
 await page.screenshot({path:output+'mobile-reduced-motion.png'});
 const context=await page.context().browser().newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
 const touch=await context.newPage();await touch.goto(url);
 const b=await touch.getByRole('button',{name:'Лев Мастер',exact:true}).boundingBox();
 await touch.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);
 check((await touch.locator('#name').innerText())==='Лев','real touch selects NPC');
 await context.close();
 await page.evaluate(k=>localStorage.setItem(k,JSON.stringify({version:2,stage:'NEW',copper:0,bag:0,emerald:0,npc:'toString'})),key);await page.reload();
 check((await page.locator('#save-status').innerText()).includes('Не сохранено'),'invalid snapshot rejected');
 await page.evaluate(k=>localStorage.setItem(k,'{broken'),key);await page.reload();
 check((await page.locator('#save-status').innerText()).includes('Не сохранено'),'corrupt save recovery message');
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:output+'storage-recovery.png',fullPage:true});
 await page.locator('#reset').click();await page.getByRole('button',{name:'Начать заново',exact:true}).last().click();
 check((await data()).stage==='NEW','corrupt save reset recovery');
 // Explicit browser storage failure fixture; no server or account involved.
 const deniedContext=await page.context().browser().newContext({viewport:{width:390,height:844}});
 await deniedContext.addInitScript(()=>Storage.prototype.setItem=function(){throw new Error('test storage denial');});
 const denied=await deniedContext.newPage();await denied.goto(url);
 await denied.getByRole('button',{name:'Помогу гавани',exact:true}).click();
 check((await denied.locator('#save-status').innerText()).includes('Не сохранено'),'write failure visible');
 check((await denied.locator('#quest-status').innerText()).includes('медь Льву'),'unsaved session remains usable');
 await denied.evaluate(()=>scrollTo(0,0));await denied.screenshot({path:output+'storage-denied.png',fullPage:true});await deniedContext.close();
 const contrast=await page.evaluate(()=>{
  const lum=h=>{let v=h.match(/[a-f0-9]{2}/gi).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722;};
  const ratio=(a,b)=>{const x=lum(a),y=lum(b);return Math.round((Math.max(x,y)+.05)/(Math.min(x,y)+.05)*100)/100;};
  return {body:ratio('253c3b','f4f1e8'),secondary:ratio('5e6d64','f4f1e8'),primary:ratio('fffaf0','42665b'),scene:ratio('ccd6cf','203f4a'),error:ratio('86522f','fbf9f2'),rosterBorder:ratio('839a98','264752')};
 });
 check(Object.entries(contrast).filter(([k])=>k!=='rosterBorder').every(([,v])=>v>=4.5),'critical text contrast');
 check(contrast.rosterBorder>=3,'roster border contrast');
 return {checks,contrast,passed:true,scope:'desktop 1440; responsive 1024/850/768/560/390; touch; keyboard/Escape; reduced motion; complete quest; persistence; corrupt/denied storage'};
}

