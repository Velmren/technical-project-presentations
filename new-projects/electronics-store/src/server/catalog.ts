import {publicReviewWhere} from './review-visibility';
import {db} from './db';
import {productView,genuineReviews} from './commerce';
import {ApiError} from './validation';
function numberParam(p:URLSearchParams,key:string,fallback:number,min:number,max:number,integer=false){
 const raw=p.get(key);if(raw===null||raw==='')return fallback;
 const n=Number(raw);if(!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n)))throw new ApiError(`Некорректный параметр ${key}`);return n;
}
export async function catalog(params:URLSearchParams){
 const products=await db.product.findMany({where:{active:true,variants:{some:{active:true}}},include:{variants:{where:{active:true}},reviews:genuineReviews},orderBy:{createdAt:'desc'}});
 const q=(params.get('q')??'').trim().toLowerCase().slice(0,200);
 const subcategory=params.get('subcategory');
 const category=params.get('category'),brand=params.get('brand'),storage=params.get('storage'),color=params.get('color');
 const min=numberParam(params,'min',0,0,100000000),max=numberParam(params,'max',100000000,0,100000000),rating=numberParam(params,'rating',0,0,5);
 if(min>max)throw new ApiError('Минимальная цена больше максимальной');
 const scoped=products.filter(p=>(!category||category==='all'||p.category===category)&&(!subcategory||p.subcategory===subcategory)&&(!q||`${p.name} ${p.brand} ${p.description}`.toLowerCase().includes(q)));
 const matchesVariant=(v:{price:number;storage:string;color:string;stock:number;oldPrice:number|null})=>v.price>=min&&v.price<=max&&(!storage||v.storage===storage)&&(!color||v.color===color)&&(params.get('inStock')!=='true'||v.stock>0)&&(params.get('sale')!=='true'||(v.oldPrice??0)>v.price);
 let filtered=scoped.map(p=>({...p,rating:p.reviews.length?p.reviews.reduce((sum,r)=>sum+r.rating,0)/p.reviews.length:0,reviewCount:p.reviews.length})).filter(p=>(!brand||brand.split(',').includes(p.brand))&&p.rating>=rating).flatMap(p=>{
  const selected=p.variants.filter(matchesVariant).sort((a,b)=>a.price-b.price||a.id.localeCompare(b.id))[0];
  return selected?[productView(p,selected.id)]:[];
 });
 const sort=params.get('sort');
 if(sort==='price-asc')filtered.sort((a,b)=>a.price-b.price);
 else if(sort==='price-desc')filtered.sort((a,b)=>b.price-a.price);
 else if(sort==='rating')filtered.sort((a,b)=>b.rating-a.rating);
 else if(sort!=='new'){
  const relevance=(p:any)=>q?(p.name.toLowerCase()===q?100:p.name.toLowerCase().startsWith(q)?50:p.name.toLowerCase().includes(q)?20:p.brand.toLowerCase().includes(q)?10:0):0;
  filtered.sort((a,b)=>relevance(b)-relevance(a)||Number(b.featured)-Number(a.featured)||b.reviewCount-a.reviewCount);
 }
 const page=numberParam(params,'page',1,1,100000,true),limit=numberParam(params,'limit',24,1,100,true);
 const total=filtered.length;
 filtered=filtered.slice((page-1)*limit,page*limit);
 return {products:filtered,total,page,pages:Math.ceil(total/limit),facets:{subcategories:[...new Set(products.filter(p=>!category||category==='all'||p.category===category).map(p=>p.subcategory).filter(Boolean))],brands:[...new Set(scoped.map(p=>p.brand))],categories:await db.category.findMany(),colors:[...new Set(scoped.flatMap(p=>p.variants.map(v=>v.color)))],storages:[...new Set(scoped.flatMap(p=>p.variants.map(v=>v.storage)).filter(Boolean))]}};
}
export async function product(slug:string){
 const p=await db.product.findUnique({where:{slug},include:{variants:{where:{active:true}},reviews:{where:publicReviewWhere(),orderBy:{createdAt:'desc'}},questions:{where:{status:'APPROVED'},orderBy:{createdAt:'desc'}}}});
 if(!p||!p.active)throw new ApiError('Товар не найден',404);
 const related=await db.product.findMany({where:{category:p.category,id:{not:p.id},active:true,variants:{some:{active:true}}},include:{variants:{where:{active:true}},reviews:genuineReviews},take:4});
 return {...productView(p),related:related.map(p=>productView(p))};
}
