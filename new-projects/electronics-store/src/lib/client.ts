'use client';
import {useEffect,useState,useCallback,useRef} from 'react';
let cartReady=false;
let cartBootstrap:Promise<Response>|null=null;
async function fetchStore(url:string,init:RequestInit={}){
 if(url==='/api/cart'&&!cartReady){
  if(!cartBootstrap){const initialize=()=>fetch('/api/cart');cartBootstrap=(typeof navigator!=='undefined'&&navigator.locks?navigator.locks.request('velmren-cart-bootstrap',initialize):initialize()).then(response=>{if(!response.ok)throw new Error('Не удалось загрузить корзину');cartReady=true;return response}).catch(error=>{cartBootstrap=null;throw error});}
  const response=await cartBootstrap;
  if(!init.method||init.method==='GET'){if(init.signal?.aborted)throw new DOMException('Aborted','AbortError');return response.clone();}
 }
 return fetch(url,init);
}
export async function api<T=any>(url:string,method='GET',body?:unknown):Promise<T>{const res=await fetchStore(url,{method,headers:body instanceof FormData?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});const data=await res.json().catch(()=>({error:'Не удалось прочитать ответ сервера'}));if(!res.ok)throw new Error(data.error||data.message||'Не удалось выполнить действие');return data;}
export const money=(value:number)=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(value||0);
export function useResource<T=any>(url:string){const [data,setData]=useState<T|null>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(true);const pending=useRef<AbortController|null>(null);const reload=useCallback(async()=>{pending.current?.abort();const controller=new AbortController();pending.current=controller;setError('');try{const res=await fetchStore(url,{signal:controller.signal});const result=await res.json();if(!res.ok)throw new Error(result.error||result.message||'Не удалось загрузить данные');if(!controller.signal.aborted)setData(result)}catch(e){if(!controller.signal.aborted)setError((e as Error).message)}finally{if(!controller.signal.aborted)setLoading(false)}},[url]);useEffect(()=>{setLoading(true);void reload();return()=>pending.current?.abort()},[reload]);return {data,setData,error,loading,reload};}
export function notify(message:string){window.dispatchEvent(new CustomEvent('store:toast',{detail:message}));}
export function refreshStore(){window.dispatchEvent(new Event('store:refresh'));}
export async function addToCart(variantId:string,quantity=1){await api('/api/cart','POST',{variantId,quantity});refreshStore();notify('Товар добавлен в корзину');}
export function localIds(key:string):string[]{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return []}}
export function toggleLocal(key:string,id:string){const ids=localIds(key);const next=ids.includes(id)?ids.filter(x=>x!==id):[...ids,id];localStorage.setItem(key,JSON.stringify(next));if(key==='velmren:favorites:v1'&&!localStorage.getItem('velmren:favorites-owner:v1'))localStorage.setItem('velmren:guest-favorites:v1',JSON.stringify(next));refreshStore();return next;}
export async function syncFavoritesOnLogin(userId:string){const previousOwner=localStorage.getItem('velmren:favorites-owner:v1');const guest=localIds('velmren:guest-favorites:v1');if(!previousOwner&&!guest.length)guest.push(...localIds('velmren:favorites:v1'));localStorage.setItem('velmren:favorites-owner:v1',userId);if(previousOwner!==userId)localStorage.setItem('velmren:favorites:v1','[]');await Promise.allSettled(guest.map(productId=>api('/api/favorites','POST',{productId})));const own=await api<{id:string}[]>('/api/favorites');localStorage.setItem('velmren:favorites:v1',JSON.stringify(own.map(p=>p.id)));localStorage.removeItem('velmren:guest-favorites:v1');refreshStore();}
export function clearFavoritesOnLogout(){localStorage.removeItem('velmren:favorites-owner:v1');localStorage.setItem('velmren:favorites:v1','[]');localStorage.removeItem('velmren:guest-favorites:v1');refreshStore();}
export async function syncFavoritesSession(){const session=await api('/api/auth/get-session');if(session?.user?.id)await syncFavoritesOnLogin(session.user.id);else if(localStorage.getItem('velmren:favorites-owner:v1'))clearFavoritesOnLogout();}
