import {readFile,access,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),p=JSON.parse(await readFile(new URL('data/catalog.json',root),'utf8'));
const ids=new Set(),skus=new Set(),paths=new Set();
for(const product of p){
 if(!product.subcategory)throw new Error(`No subcategory ${product.id}`);
 for(const v of product.variants){if(ids.has(v.id)||skus.has(v.sku))throw new Error(`Duplicate ${v.id}`);ids.add(v.id);skus.add(v.sku);if(v.active!==false&&!v.images?.length)throw new Error(`No gallery ${v.id}`);for(const path of v.images)paths.add(path);}
 for(const path of product.images)paths.add(path);
 const colors=[...new Map(product.variants.filter(v=>v.active!==false).map(v=>[v.color,v])).values()];
 const hashes=await Promise.all(colors.map(async v=>createHash('sha256').update(await readFile(new URL('public'+v.images[0],root))).digest('hex')));
 if(new Set(hashes).size!==colors.length)throw new Error(`Shared photography for different active colors: ${product.id}`);
}
for(const path of paths){const file=fileURLToPath(new URL('public'+path,root));await access(file);await sharp(file).metadata();}
const colors=p.filter(x=>x.category==='smartphones'&&x.brand==='Apple').flatMap(product=>[...new Map(product.variants.map(v=>[v.color,v])).values()].map(v=>({label:`${product.id} ${v.color}`,image:v.images[0],views:v.images.length})));
await mkdir(new URL('docs/catalog-previews/',root),{recursive:true});
for(let start=0;start<colors.length;start+=20){const items=colors.slice(start,start+20),cols=5,w=220,h=270,images=[];
 for(const [i,item] of items.entries()){images.push({input:await sharp(fileURLToPath(new URL('public'+item.image,root))).resize(200,220,{fit:'contain',background:'#fff'}).png().toBuffer(),left:(i%cols)*w+10,top:Math.floor(i/cols)*h});images.push({input:Buffer.from(`<svg width="220" height="50"><rect width="220" height="50" fill="white"/><text x="8" y="17" font-family="Arial" font-size="11">${item.label.split(' ').shift()}</text><text x="8" y="34" font-family="Arial" font-size="12">${item.label.split(' ').slice(1).join(' ')}</text></svg>`),left:(i%cols)*w,top:Math.floor(i/cols)*h+220});}
 await sharp({create:{width:cols*w,height:Math.ceil(items.length/cols)*h,channels:3,background:'#fff'}}).composite(images).png().toFile(fileURLToPath(new URL(`docs/catalog-previews/iphone-colors-${start/20+1}.png`,root)));
}
const report={products:p.length,variants:ids.size,activeVariants:p.flatMap(x=>x.variants).filter(v=>v.active!==false).length,retiredVariants:p.flatMap(x=>x.variants).filter(v=>v.active===false).length,categories:Object.fromEntries([...new Set(p.map(x=>x.category))].map(c=>[c,p.filter(x=>x.category===c).length])),images:paths.size,iphoneColors:colors.length,iphoneColorsWithMultipleViews:colors.filter(x=>x.views>1).length,distinctPhotosForAllActiveColors:true};
console.log(JSON.stringify(report,null,2));await writeFile(new URL('docs/catalog-validation.json',root),JSON.stringify(report,null,2)+'\n');
