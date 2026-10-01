export type Variant = {id:string;active?:boolean;images?:string[];sku:string;color:string;colorHex:string;storage:string;price:number;oldPrice?:number|null;stock:number};
export type Product = {selectedVariantId?:string;id:string;slug:string;name:string;brand:string;category:string;subcategory?:string;description:string;tagline:string;images:string[];specs:Record<string,string>;features:string[];inBox:string[];rating:number;reviewCount:number;featured:boolean;badge?:string|null;modelUrl?:string|null;videoUrl?:string|null;variants:Variant[];price:number;oldPrice?:number|null;stock:number;reviews?:Review[];questions?:Question[];related?:Product[]};
export type Review={id:string;author:string;rating:number;title:string;text:string;isDemo:boolean;createdAt:string};
export type Question={id:string;author:string;text:string;answer?:string;createdAt:string};
export type Category={id:string;slug:string;name:string};
export type Catalog={products:Product[];total:number;page:number;pages:number;facets:{subcategories?:string[];brands:string[];categories:Category[];colors:string[];storages:string[]}};
export const categoryLabels:Record<string,string>={smartphones:'Смартфоны',laptops:'Ноутбуки',tablets:'Планшеты',audio:'Наушники и звук',watches:'Смарт-часы',gaming:'Игры и консоли',cameras:'Камеры', 'smart-home':'Умный дом',accessories:'Аксессуары',home:'Техника для дома'};
