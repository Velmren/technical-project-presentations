import type { Language } from './i18n';
export const models = [
  { id:'one', name:'SONO One', price:149, battery:24, power:20, weight:640, dimensions:[148,118,92] },
  { id:'plus', name:'SONO One Plus', price:229, battery:32, power:40, weight:980, dimensions:[192,150,118] }
];
export const price = (amount: number, language: Language = 'en') => new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : 'en-IE', { style:'currency',currency:'EUR',maximumFractionDigits:0 }).format(amount);
export type Model = typeof models[number];
export type Item = { model:Model; color:string; quantity:number };
