/** Retain historical variants, publish only visually verified offers. */
import {readFile,writeFile,access} from 'node:fs/promises';
import sharp from 'sharp';
const p=JSON.parse(await readFile('data/catalog.json','utf8'));
// Historical database offer was not in the original JSON. Keep its identity,
// but never publish an unsupported 2016 A57 color/storage combination.
const a57=p.find(x=>x.id==='oppo-a57');
if(!a57.variants.some(v=>v.id==='oppo-a57-v2'))a57.variants.push({id:'oppo-a57-v2',sku:'EL-OPPO-A57-02',color:'Светящийся чёрный',colorHex:'#262c30',storage:'64 ГБ',price:12990,oldPrice:14990,stock:17,active:false,images:[]});
const sources=JSON.parse(await readFile('docs/catalog-asset-sources.json','utf8'));
const cdn=n=>`https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/${n}?wid=1000&hei=1000&fmt=png-alpha`;
async function image(id,key,url,page,author='Apple Inc.',optional=false){
 const path=`/products/${id}-verified-${key}.webp`;
 try{await access('public'+path);}catch{let r;try{r=await fetch(url,{signal:AbortSignal.timeout(15000)});}catch(error){if(optional)return null;throw error;}if(!r.ok){if(optional)return null;throw new Error(`${r.status}: ${url}`);}await sharp(Buffer.from(await r.arrayBuffer())).webp({quality:88}).toFile('public'+path);}
 const record={file:path,source:url,page,author,license:`Copyright ${author}; not an open license. Portfolio study only; commercial permission required.`,changes:'Encoded WebP; no recoloring or generated product content.'};
 const existing=sources.findIndex(x=>x.file===path);if(existing<0)sources.push(record);else sources[existing]=record;
 return path;
}
for(const product of p)for(const v of product.variants)v.active=true;
const official=[
 ['apple-macbook-pro-14-inch-space-grey','https://support.apple.com/en-us/111902',[['Серый космос','spacegray','mbp14-spacegray-select-202110'],['Серебристый','silver','mbp14-silver-select-202110']]],
 ['ipad-mini-2021-starlight','https://support.apple.com/en-us/111886',[['Сияющая звезда','starlight','ipad-mini-select-wifi-starlight-202109'],['Серый космос','spacegray','ipad-mini-select-wifi-space-gray-202109']]],
 ['apple-airpods-max-silver','https://support.apple.com/en-us/111858',[['Серебристый','silver','airpods-max-select-silver-202011'],['Серый космос','spacegray','airpods-max-select-spacegray-202011']]],
 ['apple-homepod-mini-cosmic-grey','https://support.apple.com/en-us/111914',[['Серый космос','spacegray','homepod-mini-select-spacegray-202110'],['Белый','white','homepod-mini-select-white-202110']]],
 ['beats-flex-wireless-earphones','https://www.beatsbydre.com/earbuds/beats-flex',[['Жёлтый','yellow','MYMD2'],['Чёрный','black','MYMC2']]],
];
for(const [id,page,colors] of official){
 const product=p.find(x=>x.id===id);
 for(const [color,key,n] of colors){const first=await image(id,`${key}-1`,cdn(n),page);const second=await image(id,`${key}-2`,cdn(n+'_AV1'),page,'Apple Inc.',true);for(const v of product.variants.filter(v=>v.color===color))v.images=[first,...(second?[second]:[])];}
 product.images=product.variants[0].images;
 console.log(id,'verified',colors.length,'colors');
}
const keep={
 'oppo-a57':'Золотистый',
 'apple-watch-series-4-gold':'Золотой',
 'oppo-f19-pro-plus':'Чёрный',
 'oppo-k1':'Астральный синий',
 'realme-c35':'Светящийся зелёный',
 'realme-x':'Синий',
 'realme-xt':'Жемчужно-синий',
 'samsung-galaxy-s7':'Чёрный оникс',
 'samsung-galaxy-s8':'Чёрный бриллиант',
 'samsung-galaxy-s10':'Оникс',
 'vivo-s1':'Небесно-голубой',
 'vivo-v9':'Золотистый',
 'vivo-x21':'Красный',
 'huawei-matebook-x-pro':'Серый космос',
 'lenovo-yoga-920':'Серебристый',
 'samsung-galaxy-tab-s8-plus-grey':'Графитовый',
 'amazon-echo-plus':'Серый',
};
const retired=[];
for(const [id,color] of Object.entries(keep)){
 const product=p.find(x=>x.id===id);
 for(const v of product.variants){v.active=v.color===color;if(!v.active)retired.push({product:id,variant:v.id,color:v.color,storage:v.storage,reason:'No verified photograph of this exact color in the available source set; historical row retained.'});}
 product.images=product.variants.find(v=>v.active).images;
}
// Replace the ambiguous legacy tablet image with exact official Graphite photography.
const tablet=p.find(x=>x.id==='samsung-galaxy-tab-s8-plus-grey');
const samsungPage='https://www.samsung.com/pk/business/tablets/galaxy-tab-s/galaxy-tab-s8-plus-gray-8gb-128gb-sm-x800nzaamea/';
const samsungBase='https://images.samsung.com/is/image/samsung/p6pim/pk/sm-x800nzaamea/gallery/pk-galaxy-tab-s8-plus-wifi-x800-sm-x800nzaamea-';
const tabletImages=await Promise.all(['535271335','535271314'].map((n,i)=>image(tablet.id,`graphite-${i+1}`,samsungBase+n+'?$Q90_684_547_JPG$',samsungPage,'Samsung Electronics')));
for(const v of tablet.variants.filter(v=>v.active))v.images=tabletImages;tablet.images=tabletImages;
// Regional 512GB S10+ colors differ; only the photographed Prism Black 128GB offer is published.
const s10=p.find(x=>x.id==='samsung-galaxy-s10');
for(const v of s10.variants.filter(v=>v.active&&v.storage==='512 ГБ')){v.active=false;retired.push({product:s10.id,variant:v.id,color:v.color,storage:v.storage,reason:'512GB finish differs by region; exact photographed configuration unverified.'});}
for(const product of p){
 for(const v of product.variants)if(!v.active)v.images=[];
 const active=product.variants.filter(v=>v.active);if(!active.length)throw new Error(`No active offer ${product.id}`);
 const byColor=[...new Map(active.map(v=>[v.color,v.images[0]])).entries()];
 if(new Set(byColor.map(x=>x[1])).size!==byColor.length)throw new Error(`Decorative color swatches remain: ${product.id}`);
 const visible=JSON.stringify({name:product.name,description:product.description,specs:product.specs,features:product.features,inBox:product.inBox});if(/демо|тестов|dummy|placeholder/i.test(visible))throw new Error(`Demo copy remains ${product.id}`);
}
await writeFile('data/catalog.json',JSON.stringify(p,null,2)+'\n');
await writeFile('docs/catalog-asset-sources.json',JSON.stringify(sources,null,2)+'\n');
await writeFile('docs/catalog-retired-variants.json',JSON.stringify(retired,null,2)+'\n');
console.log(JSON.stringify({models:p.length,allVariants:p.flatMap(x=>x.variants).length,activeVariants:p.flatMap(x=>x.variants).filter(v=>v.active).length,retired:retired.length,distinctColorGalleries:true}));
