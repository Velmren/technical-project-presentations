/** Reproducible manufacturer catalog enrichment. Never writes the database.
 * Follow with `node scripts/correct-legacy-colors.mjs` before seeding so that
 * all legacy color verification and historical-offer retirement is retained.
 */
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
const catalog=JSON.parse(await readFile(new URL('../data/catalog.json',import.meta.url),'utf8'));
const root=new URL('../',import.meta.url);
const sources=[];
const color=(key,name,hex)=>({key,name,hex});
const titanium=[color('naturaltitanium','Натуральный титан','#b5aea3'),color('bluetitanium','Синий титан','#465361'),color('blacktitanium','Чёрный титан','#3d3e40'),color('whitetitanium','Белый титан','#dedbd4')];
const sixteen=[color('ultramarine','Ультрамарин','#8993d8'),color('teal','Бирюзовый','#9cbeb5'),color('black','Чёрный','#353638'),color('pink','Розовый','#eda8d0'),color('white','Белый','#eae9e5')];
const fifteen=[color('blue','Голубой','#b6ceda'),color('pink','Розовый','#eac1ca'),color('black','Чёрный','#3f4344'),color('green','Зелёный','#c8d6bf'),color('yellow','Жёлтый','#eadfa7')];
const pro16=[titanium[0],color('deserttitanium','Пустынный титан','#c4a992'),titanium[2],titanium[3]];
const pro13=[color('blue','Небесно-голубой','#adc5da'),color('graphite','Графитовый','#535450'),color('silver','Серебристый','#ecebe7'),color('gold','Золотой','#e8d9be'),color('green','Альпийский зелёный','#5b6e5f')];
const pro14=[color('deeppurple','Тёмно-фиолетовый','#675f72'),color('spaceblack','Чёрный космос','#494845'),color('silver','Серебристый','#e9e8e3'),color('gold','Золотой','#e8dabd')];
const basic13=[color('blue','Синий','#7b9cad'),color('pink','Розовый','#ead3d0'),color('midnight','Тёмная ночь','#414a50'),color('starlight','Сияющая звезда','#f1ece6'),color('red','Красный','#bd2531'),color('green','Зелёный','#57695b')];
const basic14=[color('blue','Голубой','#a2b4c7'),color('purple','Фиолетовый','#d5cddb'),color('midnight','Тёмная ночь','#343c43'),color('starlight','Сияющая звезда','#f0ece7'),color('red','Красный','#e6444d'),color('yellow','Жёлтый','#f4df91')];
const capacities=['128 ГБ','256 ГБ','512 ГБ'];
function add(id,name,category,tagline,description,specs,inBox,price){
 let p=catalog.find(x=>x.id===id);
 if(!p){p={id,slug:id,name,brand:'Apple',category,description,tagline,images:[],specs,features:Object.values(specs).slice(0,4),inBox,rating:0,reviewCount:0,featured:false,variants:[]};catalog.push(p);}
 return p;
}
function phone(id,name,screen,chip,cameras,weight,battery,price,usb='USB-C, USB 2'){
 return add(id,`Apple ${name}`,'smartphones',`${screen}. ${chip}.`,`${name} сочетает OLED-экран ${screen} с чипом ${chip}. Снимайте фото и видео, пользуйтесь бесконтактной оплатой и храните медиатеку в выбранном объёме памяти. Face ID защищает доступ к устройству.`,{'Экран':`${screen} Super Retina XDR`,'Процессор':chip,'Камеры':cameras,'Фронтальная камера':'12 Мп TrueDepth','Разъём':usb,'Связь':'5G, Wi-Fi, Bluetooth, NFC','Защита':'IP68','Автономность':`До ${battery} ч воспроизведения видео`,'Вес':`${weight} г`},[name,usb.startsWith('USB-C')?'Кабель USB-C':'Кабель USB-C — Lightning','Документация'],price);
}
phone('iphone-15-plus','iPhone 15 Plus','6,7″','Apple A16 Bionic','48 + 12 Мп, оптический диапазон 0,5× / 1× / 2×',201,26,79990);
phone('iphone-16-plus','iPhone 16 Plus','6,7″','Apple A18','48 Мп Fusion + 12 Мп, макросъёмка',199,27,94990);
phone('iphone-16-pro','iPhone 16 Pro','6,3″, ProMotion до 120 Гц','Apple A18 Pro','48 Мп Fusion + 48 Мп сверхширокоугольная + 12 Мп телефото 5×',199,27,114990,'USB-C, USB 3 до 10 Гбит/с');
phone('iphone-16-pro-max','iPhone 16 Pro Max','6,9″, ProMotion до 120 Гц','Apple A18 Pro','48 Мп Fusion + 48 Мп сверхширокоугольная + 12 Мп телефото 5×',227,33,129990,'USB-C, USB 3 до 10 Гбит/с');
phone('iphone-14','iPhone 14','6,1″','Apple A15 Bionic','12 + 12 Мп, стабилизация сдвигом матрицы',172,20,54990,'Lightning');
phone('iphone-14-pro','iPhone 14 Pro','6,1″, ProMotion до 120 Гц','Apple A16 Bionic','48 + 12 + 12 Мп, телефото 3×',206,23,79990,'Lightning');
phone('iphone-13','iPhone 13','6,1″','Apple A15 Bionic','12 + 12 Мп, стабилизация сдвигом матрицы',174,19,44990,'Lightning');
const configs=[
 ['iphone-15-pro-max',titanium,['256 ГБ','512 ГБ','1 ТБ'],109990,'111828',k=>`iphone-15-pro-max-${k}-select`],
 ['iphone-15-pro',titanium,[...capacities,'1 ТБ'],94990,'111829',k=>`iphone-15-pro-${k}-select`],
 ['iphone-15',fifteen,capacities,69990,'111831',k=>`iphone-15-${k}-select-202309`],
 ['iphone-15-plus',fifteen,capacities,79990,'111830',k=>`iphone-15-plus-${k}-select-202309`],
 ['iphone-16',sixteen,capacities,84990,'121029',k=>`iphone-16-${k}-select-202409`],
 ['iphone-16-plus',sixteen,capacities,94990,'121030',k=>`iphone-16-plus-${k}-select-202409`],
 ['iphone-16-pro',pro16,[...capacities,'1 ТБ'],114990,'121031',k=>`iphone-16-pro-${k}-select`],
 ['iphone-16-pro-max',pro16,['256 ГБ','512 ГБ','1 ТБ'],129990,'121032',k=>`iphone-16-pro-max-${k}-select`],
 ['iphone-13-pro',pro13,[...capacities,'1 ТБ'],69990,'111871',k=>`iphone-13-pro-${k}-select`],
 ['iphone-x',[color('gray','Серый космос','#53545a'),color('silver','Серебристый','#e9e9e6')],['64 ГБ','256 ГБ'],29990,'111864',k=>`iphone-x-${k}-select-2017`],
 ['iphone-14',basic14,capacities,54990,'111850',k=>`iphone-14-${k}-select-202209`],
 ['iphone-14-pro',pro14,[...capacities,'1 ТБ'],79990,'111849',k=>`iphone-14-pro-${k}-select`],
 ['iphone-13',basic13,capacities,44990,'111872',k=>`iphone-13-${k}-select-2021`],
];
const cdn=n=>`https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/${n}?wid=1000&hei=1000&fmt=png-alpha`;
async function asset(id,key,n,page,optional=false){
 const local=`products/${id}-${key}.webp`, path=fileURLToPath(new URL('public/'+local,root)),url=cdn(n);
 try{await access(path);}catch{
  const response=await fetch(url);if(!response.ok){if(optional)return null;throw new Error(`${response.status} ${n}`);}
  const bytes=Buffer.from(await response.arrayBuffer());
  const meta=await sharp(bytes).metadata();if(meta.width<200)throw new Error(`Invalid asset ${n}`);
  await sharp(bytes).webp({quality:88}).toFile(path);
 }
 sources.push({file:`/${local}`,source:url,page,author:'Apple Inc.',license:'Copyright Apple Inc.; no open license. Portfolio study only, commercial use requires permission.',changes:'Encoded WebP; no recoloring or generated product content.'});
 return `/${local}`;
}
function variants(p,colors,storages,price,photos){
 const existing=p.variants;
 p.variants=colors.flatMap(c=>storages.map((storage,i)=>{
  const found=existing.find(v=>v.color===c.name&&v.storage===storage);
  return {...(found??{id:`${p.id}-${c.key}-${storage.replace(/\s+/g,'').replace('ГБ','gb').replace('ТБ','tb')}`,sku:`EL-${p.id}-${c.key}-${storage.replace(/\s+/g,'')}`.toUpperCase(),price:price+i*12000,oldPrice:price+i*12000+15000,stock:12+i*3}),color:c.name,colorHex:c.hex,storage,images:photos[c.key]};
 }));
 p.images=photos[colors[0].key];
}
for(const [id,colors,storages,price,support,filename] of configs){
 const p=catalog.find(x=>x.id===id),photos={};
 for(const c of colors){
  let n=filename(c.key);
  if(id==='iphone-14'&&c.key==='yellow')n='iphone-14-yellow-select-202303';
  if(id==='iphone-13'&&c.key==='green')n='iphone-13-green-select';
  if(id==='iphone-13'&&c.key==='red')n='iphone-13-product-red-select-2021';
  const page=`https://support.apple.com/en-us/${support}`;
  const hero=await asset(id,`${c.key}-1`,n,page);
  const detail=await asset(id,`${c.key}-2`,n+'_AV2',page,true);
  photos[c.key]=[hero,...(detail?[detail]:[])];
 }
 variants(p,colors,storages,price,photos);
 p.specs['Доступная память']=storages.join(' / ');
 p.specs['Аутентификация']='Face ID';
 p.specs['Беспроводная зарядка']=id==='iphone-x'?'Qi':'MagSafe и Qi';
 console.log(id,colors.length,'colors',p.variants.length,'variants');
}

const additions=[
 {id:'macbook-air-m2',name:'MacBook Air 13″ M2',category:'laptops',tag:'Тонкий корпус. Бесшумная работа.',description:'Ноутбук без вентилятора с экраном Liquid Retina и зарядкой MagSafe 3. Конфигурация с 8-ядерными CPU и GPU и 16 ГБ объединённой памяти подходит для учёбы, офисных задач и обработки фотографий.',specs:{'Экран':'13,6″ Liquid Retina, 2560 × 1664, 500 нит','Процессор':'Apple M2, CPU 8 ядер / GPU 8 ядер','Оперативная память':'16 ГБ','Разъёмы':'2 × Thunderbolt / USB 4, MagSafe 3, 3,5 мм','Связь':'Wi-Fi 6, Bluetooth 5.3','Камера':'FaceTime HD 1080p','Автономность':'До 18 ч воспроизведения видео','Вес':'1,24 кг'},box:['MacBook Air','Адаптер USB-C 30 Вт','Кабель USB-C — MagSafe 3'],colors:[color('midnight','Тёмная ночь','#303c46')],storage:['256 ГБ','512 ГБ'],price:89990,support:'111867',asset:()=> 'macbook-air-midnight-select-20220606'},
 {id:'macbook-air-m3',name:'MacBook Air 13″ M3',category:'laptops',tag:'Мобильная работа на M3.',description:'MacBook Air на M3 сохраняет бесшумную конструкцию и лёгкий алюминиевый корпус. Wi-Fi 6E ускоряет подключение в совместимых сетях, а при закрытой крышке можно использовать два внешних дисплея.',specs:{'Экран':'13,6″ Liquid Retina, 2560 × 1664, 500 нит','Процессор':'Apple M3, CPU 8 ядер / GPU 8 ядер','Оперативная память':'16 ГБ','Разъёмы':'2 × Thunderbolt / USB 4, MagSafe 3, 3,5 мм','Связь':'Wi-Fi 6E, Bluetooth 5.3','Камера':'FaceTime HD 1080p','Автономность':'До 18 ч воспроизведения видео','Вес':'1,24 кг'},box:['MacBook Air','Адаптер USB-C 30 Вт','Кабель USB-C — MagSafe 3'],colors:[color('midnight','Тёмная ночь','#303c46')],storage:['256 ГБ','512 ГБ'],price:104990,support:'118551',asset:()=> 'mba13-m3-midnight-gallery1-202402'},
 {id:'ipad-10',name:'iPad 10,9″ (10-го поколения)',category:'tablets',tag:'Большой экран для каждого дня.',description:'iPad с A14 Bionic, USB-C и фронтальной камерой на длинной стороне корпуса удобен для видеосвязи, заметок и чтения. Версия Wi-Fi поддерживает Apple Pencil первого поколения через адаптер и Apple Pencil USB-C.',specs:{'Экран':'10,9″ Liquid Retina, 2360 × 1640','Процессор':'Apple A14 Bionic','Камеры':'12 Мп основная / 12 Мп сверхширокоугольная фронтальная','Связь':'Wi-Fi 6, Bluetooth 5.2','Разъём':'USB-C, USB 2','Аутентификация':'Touch ID в верхней кнопке','Автономность':'До 10 ч веб-сёрфинга по Wi-Fi','Вес':'477 г (Wi-Fi)'},box:['iPad','Кабель USB-C','Адаптер USB-C 20 Вт'],colors:[color('blue','Голубой','#83b5d9')],storage:['64 ГБ','256 ГБ'],price:34990,support:'111840',asset:()=> 'ipad-2022-hero-blue-wifi-select'},
 {id:'ipad-air-11-m2',name:'iPad Air 11″ M2',category:'tablets',tag:'M2 для заметок, графики и творчества.',description:'iPad Air с чипом M2 и ламинированным экраном Liquid Retina. Поддерживает Apple Pencil Pro, а горизонтальная фронтальная камера с функцией «В центре внимания» помогает во время видеозвонков. Версия Wi-Fi.',specs:{'Экран':'11″ Liquid Retina, 2360 × 1640, 500 нит','Процессор':'Apple M2, CPU 8 ядер / GPU 9 ядер','Оперативная память':'8 ГБ','Камеры':'12 Мп основная / 12 Мп фронтальная','Связь':'Wi-Fi 6E, Bluetooth 5.3','Разъём':'USB-C, USB 3 до 10 Гбит/с','Аутентификация':'Touch ID','Вес':'462 г (Wi-Fi)'},box:['iPad Air','Кабель USB-C','Адаптер USB-C 20 Вт'],colors:[color('blue','Голубой','#bdcbd5')],storage:['128 ГБ','256 ГБ','512 ГБ','1 ТБ'],price:59990,support:'119894',asset:()=> 'ipad-air-finish-select-gallery-202405-11inch-blue'},
 {id:'ipad-pro-11-m4',name:'iPad Pro 11″ M4',category:'tablets',tag:'Tandem OLED и производительность M4.',description:'iPad Pro с экраном Ultra Retina XDR на двух OLED-панелях, тонким корпусом и Face ID. Конфигурации 256 и 512 ГБ оснащены M4 с 9-ядерным CPU, 10-ядерным GPU и 8 ГБ памяти. Версия Wi-Fi со стандартным стеклом.',specs:{'Экран':'11″ Ultra Retina XDR, Tandem OLED, ProMotion 10–120 Гц','Процессор':'Apple M4, CPU 9 ядер / GPU 10 ядер','Оперативная память':'8 ГБ','Камеры':'12 Мп основная, LiDAR / 12 Мп фронтальная','Связь':'Wi-Fi 6E, Bluetooth 5.3','Разъём':'Thunderbolt / USB 4','Аутентификация':'Face ID','Вес':'444 г (Wi-Fi)'},box:['iPad Pro','Кабель USB-C','Адаптер USB-C 20 Вт'],colors:[color('spaceblack','Чёрный космос','#424449')],storage:['256 ГБ','512 ГБ'],price:99990,support:'119892',asset:()=> 'ipad-pro-11-select-wifi-spaceblack-202405'},
 {id:'airpods-pro-2',name:'AirPods Pro 2 (USB-C)',category:'audio',tag:'Тишина по вашему желанию.',description:'Внутриканальные наушники с чипом H2, активным шумоподавлением и режимом прозрачности. Кейс MagSafe заряжается через USB-C, Qi или зарядное устройство Apple Watch. Четыре размера силиконовых вкладышей помогают подобрать посадку.',specs:{'Тип':'Внутриканальные, беспроводные','Процессор':'Apple H2','Шумоподавление':'Активное, адаптивное аудио, прозрачный режим','Автономность':'До 6 ч; до 30 ч с кейсом (ANC)','Связь':'Bluetooth 5.3','Защита':'IP54 наушники и кейс USB-C','Зарядка':'USB-C, MagSafe, Qi, зарядка Apple Watch','Управление':'Нажатия и свайпы громкости'},box:['AirPods Pro 2','Кейс MagSafe USB-C','Вкладыши XS, S, M, L','Кабель USB-C'],colors:[color('white','Белый','#f0f0f0')],storage:['USB-C'],price:23990,support:'111851',asset:()=> 'airpods-pro-2-hero-select-202409'},
 {id:'airpods-4',name:'AirPods 4',category:'audio',tag:'Открытая посадка. Простое подключение.',description:'AirPods 4 с открытой посадкой, чипом H2 и персонализированным пространственным аудио. Эта конфигурация без активного шумоподавления поставляется с компактным кейсом USB-C.',specs:{'Тип':'Вкладыши, беспроводные','Процессор':'Apple H2','Шумоподавление':'Нет активного шумоподавления','Автономность':'До 5 ч; до 30 ч с кейсом','Связь':'Bluetooth 5.3','Защита':'IP54 наушники и кейс','Зарядка':'USB-C','Вес наушника':'4,3 г'},box:['AirPods 4','Зарядный кейс USB-C','Документация'],colors:[color('white','Белый','#f0f0f0')],storage:['Без ANC'],price:14990,support:'121203',asset:()=> 'airpods-4-select-202409'},
 {id:'homepod-2',name:'HomePod (2-го поколения)',category:'smart-home',tag:'Звук, который учитывает комнату.',description:'Домашняя колонка с автоматической настройкой звучания, пространственным аудио Dolby Atmos и поддержкой AirPlay. Датчики температуры и влажности и поддержка Thread помогают связать устройства умного дома.',specs:{'Акустика':'Низкочастотный динамик 4″ и 5 высокочастотных','Звук':'Dolby Atmos, автоматическая настройка под комнату','Связь':'Wi-Fi 802.11n, Bluetooth 5.0, Thread, UWB','Экосистема':'AirPlay, Siri, HomeKit, Matter','Датчики':'Температура и влажность','Питание':'От электросети','Размеры':'168 × 142 мм','Вес':'2,3 кг'},box:['HomePod','Кабель питания','Документация'],colors:[color('midnight','Тёмная ночь','#33383d')],storage:['Стандарт'],price:34990,support:'111843',asset:()=> 'homepod-select-midnight-202210'},
 {id:'apple-tv-4k-3',name:'Apple TV 4K (3-го поколения)',category:'smart-home',tag:'Кино в 4K. Управление одним пультом.',description:'Медиаплеер с A15 Bionic, Dolby Vision и HDR10+ для совместимого телевизора. Версия 128 ГБ оснащена Gigabit Ethernet и Thread. В комплекте Siri Remote с зарядкой USB-C; кабель HDMI приобретается отдельно.',specs:{'Процессор':'Apple A15 Bionic','Видео':'До 4K 60 кадров/с, Dolby Vision, HDR10+','Аудио':'Dolby Atmos','Разъёмы':'HDMI 2.1, Gigabit Ethernet','Связь':'Wi-Fi 6, Bluetooth 5.0, Thread','Накопитель':'128 ГБ','Пульт':'Siri Remote (3-го поколения), USB-C','Размеры':'93 × 93 × 31 мм'},box:['Apple TV 4K','Siri Remote','Кабель питания','Документация'],colors:[color('black','Чёрный','#242424')],storage:['128 ГБ / Ethernet'],price:20990,support:'111839',asset:()=> 'apple-tv-4k-hero-select-202210'},
 {id:'apple-magic-mouse',name:'Magic Mouse (USB-C)',category:'accessories',tag:'Жесты на поверхности Multi-Touch.',description:'Беспроводная мышь Apple с сенсорной поверхностью Multi-Touch для прокрутки и жестов в macOS. Встроенный аккумулятор заряжается через USB-C; симметричная форма подходит для левой и правой руки.',specs:{'Тип':'Беспроводная мышь','Поверхность':'Multi-Touch','Подключение':'Bluetooth','Зарядка':'USB-C','Питание':'Встроенный аккумулятор','Совместимость':'Mac с macOS 15.1 или новее; iPadOS 18.1 или новее','Размеры':'113,5 × 57,1 × 21,6 мм','Вес':'99 г'},box:['Magic Mouse','Кабель USB-C'],colors:[color('white','Белый','#f0f0f0')],storage:['USB-C'],price:9990,support:'121931',asset:()=> 'MXK53'},
];
for(const a of additions){
 const p=add(a.id,`Apple ${a.name}`,a.category,a.tag,a.description,a.specs,a.box,a.price),photos={};
 for(const c of a.colors){const page=`https://support.apple.com/en-us/${a.support}`;const first=await asset(a.id,`${c.key}-1`,a.asset(c.key),page);const detailAsset=({'ipad-10':'ipad-10th-gen-finish-select-202212-blue-wifi_AV1','ipad-pro-11-m4':'ipad-pro-finish-select-202405-11inch-spaceblack_AV1'})[a.id]??a.asset(c.key)+'_AV1';const second=await asset(a.id,`${c.key}-2`,detailAsset,page,true);photos[c.key]=[first,...(second?[second]:[])];}
 variants(p,a.colors,a.storage,a.price,photos);console.log(a.id,p.variants.length);
}
const subcategory={smartphones:'Android',laptops:'Ультрабуки',tablets:'Android-планшеты',audio:'Наушники',watches:'Смарт-часы',gaming:'Игровые консоли',cameras:'Беззеркальные камеры','smart-home':'Умные колонки',accessories:'Зарядные устройства',home:'Пылесосы'};
for(const p of catalog){
 p.subcategory=p.category==='smartphones'&&p.brand==='Apple'?'iPhone':p.category==='laptops'&&p.brand==='Apple'?'MacBook':p.category==='tablets'&&p.brand==='Apple'?'iPad':subcategory[p.category];
 if(p.id==='steam-deck')p.subcategory='Портативные консоли';
 if(p.id==='apple-tv-4k-3')p.subcategory='Медиаплееры';
 if(p.id==='apple-magic-keyboard')p.subcategory='Клавиатуры';
 if(p.id==='apple-magic-mouse')p.subcategory='Мыши';
 if(p.id.includes('silicone-case'))p.subcategory='Чехлы';
 if(p.id==='irobot-roomba-980')p.subcategory='Роботы-пылесосы';
 for(const v of p.variants)if(!v.images)v.images=[...p.images];
 p.rating=0;p.reviewCount=0;
}
await writeFile(new URL('../data/catalog.json',import.meta.url),JSON.stringify(catalog,null,2)+'\n');
await writeFile(new URL('../docs/catalog-asset-sources.json',import.meta.url),JSON.stringify(sources,null,2)+'\n');
console.log(JSON.stringify({products:catalog.length,variants:catalog.reduce((n,p)=>n+p.variants.length,0),newImages:sources.length}));
