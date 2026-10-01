import {readFile,mkdir} from 'node:fs/promises';
import sharp from 'sharp';
const p=JSON.parse(await readFile('data/catalog.json','utf8'));
const items=p.filter(x=>!(x.category==='smartphones'&&x.brand==='Apple')&&new Set(x.variants.map(v=>v.color)).size>1).flatMap(p=>p.images.map((image,i)=>({label:`${p.id} #${i+1}`,image})));
await mkdir('docs/catalog-previews',{recursive:true});
for(let start=0;start<items.length;start+=20){const part=items.slice(start,start+20),w=230,h=235,images=[];
 for(const [i,x] of part.entries()){images.push({input:await sharp('public'+x.image).resize(210,195,{fit:'contain',background:'#fff'}).png().toBuffer(),left:(i%5)*w+10,top:Math.floor(i/5)*h});images.push({input:Buffer.from(`<svg width="230" height="40"><rect width="230" height="40" fill="white"/><text x="4" y="20" font-family="Arial" font-size="10">${x.label}</text></svg>`),left:(i%5)*w,top:Math.floor(i/5)*h+195});}
 await sharp({create:{width:5*w,height:Math.ceil(part.length/5)*h,channels:3,background:'#fff'}}).composite(images).png().toFile(`docs/catalog-previews/legacy-colors-${start/20+1}.png`);
}console.log(items.length);
