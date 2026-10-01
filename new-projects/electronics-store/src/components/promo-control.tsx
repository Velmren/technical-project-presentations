'use client';
import {useState} from 'react';
import {Check,LoaderCircle,TicketPercent,X} from 'lucide-react';
import {api,notify,refreshStore} from '@/lib/client';
import type {Cart} from './commerce/common';

export function PromoControl({cart,onChange,id='promo'}:{cart:Cart;onChange:(cart:Cart)=>void;id?:string}){
 const [code,setCode]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
 async function apply(remove=false){setBusy(true);setError('');setMessage('');try{const updated=await api<Cart>('/api/cart','PATCH',{promoCode:remove?'':code.trim()});onChange(updated);refreshStore();setCode('');const text=remove?'Промокод удалён':`Промокод ${updated.promoCode} применён`;setMessage(text);notify(text)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <div className="commerce-promo promo-control"><label htmlFor={id}>Промокод</label><div className="promo-input-row"><input id={id} value={code} onChange={e=>{setCode(e.target.value.toUpperCase());setError('')}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(code.trim()&&!busy)void apply()}}} placeholder="Введите промокод" autoCapitalize="characters" autoComplete="off" aria-describedby={error?`${id}-error`:undefined}/><button type="button" className="button secondary" disabled={busy||!code.trim()} onClick={()=>void apply()}>{busy?<LoaderCircle size={17} className="spin"/>:'Применить'}</button></div>
 {(error||cart.promoError)&&<div id={`${id}-error`} className="promo-error" role="alert">{error||cart.promoError}</div>}
 {cart.promoCode&&<div key={cart.promoCode} className={`promo-result ${cart.promoError?'invalid':''}`}><span className="promo-result-icon">{cart.promoError?<TicketPercent size={19}/>:<Check size={19}/>}</span><div><span>{cart.promoError?'Проверьте условия кода':'Промокод применён'}</span><strong>{cart.promoCode}</strong></div><button type="button" className="promo-remove" disabled={busy} aria-label={`Удалить промокод ${cart.promoCode}`} onClick={()=>void apply(true)}><X size={14}/><span>Удалить</span></button></div>}
 <span className="sr-only" aria-live="polite">{message}</span></div>
}
