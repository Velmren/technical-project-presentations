const $=id=>document.getElementById(id);
const KEY='velmren.north-harbor.v2';
const stages=['NEW','SUPPLY','INSPECTION','RETURN','COMPLETE'];
const fresh=()=>({version:2,stage:'NEW',copper:0,bag:0,emerald:0,npc:'mara'});
const people={mara:{name:'Мара',role:'Смотритель гавани',number:'01'},lev:{name:'Лев',role:'Мастер',number:'02'},nika:{name:'Ника',role:'Сигнальщик',number:'03'}};
let state=fresh(),saveProblem=false;
function valid(s){return s&&s.version===2&&stages.includes(s.stage)&&Number.isInteger(s.copper)&&s.copper>=0&&s.copper<=3&&Number.isInteger(s.bag)&&s.bag>=0&&s.bag<=3&&Number.isInteger(s.emerald)&&s.emerald===(s.stage==='COMPLETE'?1:0)&&Object.hasOwn(people,s.npc)&&
 (s.stage==='NEW'?s.copper===0:s.stage==='SUPPLY'?s.copper<3:s.copper===3);}
let initialMessage='';
try{const raw=localStorage.getItem(KEY);if(raw){const saved=JSON.parse(raw);if(!valid(saved))throw new Error('invalid');state=saved;initialMessage='Ваше приключение продолжено с сохранённого шага.';}}catch{saveProblem=true;initialMessage='Сохранение недоступно или повреждено. Demo работает в этой вкладке; начните заново, чтобы очистить прогресс.';}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));saveProblem=false;}catch{saveProblem=true;}}
function button(label,action,primary=false){return {label,action,primary};}
function content(){
 const s=state.stage;
 if(state.npc==='mara'){
  if(s==='NEW')return ['Буря погасила наш сигнальный фонарь. Судам нужен свет, чтобы найти дорогу домой. Поможешь? Льву нужны три медных слитка, а Ника проверит сигнал.',[button('Помогу гавани','accept',true),button('Пока не готов','later')]];
  if(s==='SUPPLY')return ['Спасибо, что откликнулся. Лев ждёт в мастерской. Передай ему три медных слитка — по одному, чтобы ничего лишнего не потратить.',[button('Пойти к Льву','lev',true)]];
  if(s==='INSPECTION')return ['Лев уже починил контакты. Ника ждёт у фонаря: осталось проверить, всё ли в порядке с сигналом.',[button('Пойти к Нике','nika',true)]];
  if(s==='RETURN')return ['Вижу свет! Ника подтвердила: сигнал чистый. Теперь корабли найдут гавань. Спасибо за помощь — этот изумруд твой.',[button('Завершить задание · 1 изумруд','claim',true)]];
  return ['Гавань снова на связи. Твой изумруд уже в рюкзаке. Если окажешься здесь после следующего шторма — заходи. Хорошего пути!',[button('Заглянуть к Нике','nika')]];
 }
 if(state.npc==='lev'){
  if(s==='NEW')return ['Контакты прогорели, но я знаю, как их починить. Поговори с Марой у пристани — она расскажет, какая помощь нужна гавани.',[button('Пойти к Маре','mara',true)]];
  if(s==='SUPPLY')return [state.copper===0?'Для новых контактов нужны три медных слитка. У тебя есть медь? Передавай по одному, остальное пусть остаётся в рюкзаке.':'Хорошая медь. Уже получил '+state.copper+' из трёх слитков. Ещё '+(3-state.copper)+' — и можно проверять сигнал.',[button('Передать медный слиток','offer',true),button('Зачем именно медь?','why')]];
  return ['Контакты на месте. За проверку отвечает Ника у фонаря. А я пока наведу порядок в мастерской.',[button('Пойти к Нике','nika',true)]];
 }
 if(s==='NEW'||s==='SUPPLY')return ['Сейчас сигнал не проходит. Лев должен заменить контакты — ему нужны три медных слитка. Потом проверим фонарь вместе.',[button(s==='NEW'?'Пойти к Маре':'Пойти к Льву',s==='NEW'?'mara':'lev',true)]];
 if(s==='INSPECTION')return ['Лев закончил с контактами. Осталось проверить, виден ли сигнал с моря. Готов включить фонарь?',[button('Проверить сигнал','inspect',true)]];
 if(s==='RETURN')return ['Всё работает. Свет видно даже за мысом! Возвращайся к Маре — она ждёт тебя у пристани.',[button('Вернуться к Маре','mara',true)]];
 return ['Фонарь светит ровно. Этой ночью корабли вернутся домой. Ты вовремя оказался в гавани.',[button('Вернуться к Маре','mara')]];
}
function render(message='',error=false){
 const npc=people[state.npc],index=stages.indexOf(state.stage),[text,choices]=content();
 $('name').textContent=npc.name;$('role').textContent=npc.role;$('speaker-number').textContent=npc.number;
 $('portrait').src='assets/'+state.npc+'.svg';
 $('role-state').textContent=['Знакомство','Сбор материалов','Проверка','Возвращение','Завершено'][index];
 $('speech').textContent=text;
 $('choices').replaceChildren(...choices.map(choice=>{const b=document.createElement('button');b.className=choice.primary?'primary':'';b.dataset.action=choice.action;b.append(document.createTextNode(choice.label));const icon=document.createElement('span');icon.textContent='→';icon.setAttribute('aria-hidden','true');b.append(icon);return b;}));
 document.querySelectorAll('[data-npc]').forEach(b=>{const selected=b.dataset.npc===state.npc;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
 $('feedback').textContent=message;$('feedback').className=error?'error':'';
 $('copper').textContent=state.bag;$('emerald').textContent=state.emerald;
 $('gather').disabled=state.bag>=3;$('gather').textContent=state.bag>=3?'Медь: 3 / 3':'+ Взять медь';
 $('supply-count').textContent='Лев · медь '+state.copper+' / 3';
 $('quest-status').textContent=['Поговорите с Марой','Передайте медь Льву','Проверьте фонарь с Никой','Вернитесь к Маре за наградой','Завершено · 1 изумруд получен'][index];
 document.querySelectorAll('[data-step]').forEach((li,i)=>{const done=index>i;li.classList.toggle('done',done);li.classList.toggle('active',index===i);li.querySelector('.step-number').textContent=done?'✓':String(i+1).padStart(2,'0');if(index===i)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');});
 $('save-status').textContent=saveProblem?'Не сохранено · прогресс только в этой вкладке':'Прогресс сохраняется в этом браузере';
 document.querySelector('.explore').classList.toggle('completed',index>=3);
 $('scene-success').hidden=index<3;$('scene-success').textContent=index===4?'Гавань снова на связи':'Сигнал восстановлен';
}
function act(action){
 let message='',error=false;
 if(Object.hasOwn(people,action)){state.npc=action;}
 else if(action==='accept'&&state.stage==='NEW'&&state.npc==='mara'){state.stage='SUPPLY';message='Задание принято. Теперь отправляйтесь к Льву.';}
 else if(action==='offer'&&state.stage==='SUPPLY'&&state.npc==='lev'){
  if(state.bag===0){message='В рюкзаке нет меди. Нажмите «Взять медь», затем передайте слиток Льву.';error=true;}
  else{state.bag--;state.copper++;if(state.copper===3)state.stage='INSPECTION';message=state.copper===3?'Три слитка переданы. Контакты готовы — идите к Нике.':'Передан 1 слиток. Получено: '+state.copper+' / 3.';}
 }else if(action==='inspect'&&state.stage==='INSPECTION'&&state.npc==='nika'){state.stage='RETURN';message='Сигнал проверен. Фонарь снова светит! Вернитесь к Маре.';}
 else if(action==='claim'&&state.stage==='RETURN'&&state.npc==='mara'){state.stage='COMPLETE';state.emerald=1;message='Задание завершено. В рюкзак добавлен 1 изумруд.';}
 else if(action==='gather'){
  if(state.bag<3){state.bag++;message='В рюкзак добавлен 1 медный слиток для demo.';}
 }else if(action==='later'){message='Мара подождёт. Когда будете готовы, вернитесь к разговору.';}
 else if(action==='why'){message='«Медь проводит сигнал. Три слитка — ровно столько нужно для новых контактов». — Лев';}
 save();render(message,error);
}
document.querySelector('.roster').addEventListener('click',e=>{const b=e.target.closest('[data-npc]');if(b){act(b.dataset.npc);if(matchMedia('(max-width:560px)').matches)$('dialogue').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});}});
let lastAction=null;
function choiceClick(e){const b=e.target.closest('[data-action]');if(!b)return;lastAction=b.dataset.action;act(lastAction);$('choices').querySelector('button')?.focus({preventScroll:true});}
$('choices').addEventListener('click',choiceClick);
$('gather').addEventListener('click',()=>act('gather'));
$('reset').addEventListener('click',()=>$('reset-dialog').showModal());
$('reset-dialog').addEventListener('close',()=>{if($('reset-dialog').returnValue==='reset'){state=fresh();save();render('Новое приключение началось. Поговорите с Марой.');}$('reset').focus({preventScroll:true});});
window.addEventListener('storage',e=>{if(e.key!==KEY)return;try{const s=JSON.parse(e.newValue);if(valid(s)){state=s;render('Прогресс обновлён из другой вкладки.');}}catch{}});
render(initialMessage,saveProblem);
