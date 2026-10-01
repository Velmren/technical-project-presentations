import {ApiError} from './validation';

export type PaymentMethod='card'|'sbp'|'cash';
export type PaymentStatus='PENDING'|'PAID'|'FAILED'|'REFUNDED';
export type FulfillmentStatus='PENDING_PAYMENT'|'PROCESSING'|'SHIPPED'|'DELIVERED'|'CANCELLED';
export type PaymentEventInput={orderId:string;eventId:string;result:'success'|'failure'};
export type StoredPaymentEvent={orderId:string;eventId:string;result:string};
export type PaymentResolution=
 | {kind:'success';event:PaymentEventInput;paymentStatus:'PAID';status:'PROCESSING';message:string}
 | {kind:'failure';event:PaymentEventInput;paymentStatus:'FAILED';status:'PENDING_PAYMENT';message:string}
 | {kind:'repeated';event:PaymentEventInput};
export interface PaymentProvider {
 readonly mode:'test'|'live';
 resolveEvent(event:PaymentEventInput,previous:StoredPaymentEvent|null):Promise<PaymentResolution>;
 refund(input:{orderId:string;testMode:boolean}):Promise<{paymentStatus:'REFUNDED';message:string}>;
}
export type ShipmentInput={orderId:string;orderNumber:string;currentStatus:FulfillmentStatus;nextStatus:FulfillmentStatus;paymentMethod:PaymentMethod;paymentStatus:PaymentStatus;testMode:boolean};
export type ShipmentResolution={status:'SHIPPED'|'DELIVERED';paymentStatus:PaymentStatus;trackingNumber?:string;message:string};
export interface ShippingProvider {
 readonly mode:'test'|'live';
 transition(input:ShipmentInput):Promise<ShipmentResolution>;
}
export class TestPaymentProvider implements PaymentProvider {
 readonly mode='test' as const;
 async resolveEvent(event:PaymentEventInput,previous:StoredPaymentEvent|null):Promise<PaymentResolution>{
  if(previous){
   if(previous.orderId!==event.orderId||previous.result!==event.result||previous.eventId!==event.eventId)throw new ApiError('Конфликт идентификатора события',409);
   return {kind:'repeated',event};
  }
  return event.result==='success'
   ?{kind:'success',event,paymentStatus:'PAID',status:'PROCESSING',message:'Оплата подтверждена.'}
   :{kind:'failure',event,paymentStatus:'FAILED',status:'PENDING_PAYMENT',message:'Оплата отклонена. Можно повторить.'};
 }
 async refund(input:{orderId:string;testMode:boolean}){
  if(!input.testMode||process.env.TEST_MODE!=='true')throw new ApiError('Тестовый возврат недоступен',403);
  return {paymentStatus:'REFUNDED' as const,message:'Заказ отменён. Возврат выполнен.'};
 }
}
export class TestShippingProvider implements ShippingProvider {
 readonly mode='test' as const;
 async transition(input:ShipmentInput):Promise<ShipmentResolution>{
  if(!input.testMode||process.env.TEST_MODE!=='true')throw new ApiError('Тестовая доставка недоступна',403);
  const allowed:Partial<Record<FulfillmentStatus,FulfillmentStatus>>={PROCESSING:'SHIPPED',SHIPPED:'DELIVERED'};
  const cashPending=input.paymentMethod==='cash'&&input.paymentStatus==='PENDING';
  if(input.nextStatus!==allowed[input.currentStatus]||(input.paymentStatus!=='PAID'&&!cashPending))throw new ApiError('Недопустимый переход статуса',409);
  if(input.nextStatus==='SHIPPED')return {status:'SHIPPED',paymentStatus:input.paymentStatus,trackingNumber:`VE-${input.orderNumber}`,message:'Заказ передан курьеру.'};
  return {status:'DELIVERED',paymentStatus:'PAID',message:cashPending?'Заказ получен, оплата при получении подтверждена.':'Заказ получен.'};
 }
}
// Live providers implement these contracts; their verified webhooks and credentials are not configured.
export const paymentProvider:PaymentProvider=new TestPaymentProvider();
export const shippingProvider:ShippingProvider=new TestShippingProvider();
