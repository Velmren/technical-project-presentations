// Standalone demo only: answers the requests a store would answer.
// The cart lives in localStorage; delivery dates come from the server's own
// estimate module, loaded in the browser instead of behind the app proxy.
import { addItems, cartState, updateLines } from './cart.mjs';
import { estimateDelivery } from '../delivery/estimate.mjs';

const config = JSON.parse(document.getElementById('demo-config').textContent);
const STORAGE_KEY = 'sheaf-demo-cart';
const nativeFetch = window.fetch.bind(window);

function loadCart() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || [];
  } catch (error) {
    return [];
  }
}

function saveCart(cart) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch (error) {
    // Private mode: the cart then lasts for the page only.
  }
  return cart;
}

function findVariant(id) {
  for (const product of config.products) {
    const variant = product.variants.find((candidate) => candidate.id === Number(id));
    if (variant) return { product, variant };
  }
  return null;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

const handlers = [
  [/\/cart\/add\.js$/, (url, body) => {
    const cart = loadCart();
    const result = addItems(cart, body.items || [body], findVariant);
    if (result.error) return json(result.error, result.error.status);
    saveCart(cart);
    return json(body.items ? result : result.items[0]);
  }],
  [/\/cart\/(change|update)\.js$/, (url, body) => {
    const updates = url.pathname.endsWith('change.js') ? { [body.id]: body.quantity } : body.updates || {};
    return json(cartState(saveCart(updateLines(loadCart(), updates)), config.currency));
  }],
  [/\/cart\/clear\.js$/, () => json(cartState(saveCart([]), config.currency))],
  [/\/cart\.js$/, () => json(cartState(loadCart(), config.currency))],
  [/\/apps\/sheaf-delivery\/estimate$/, (url) =>
    json(
      estimateDelivery({
        now: new Date(),
        country: (url.searchParams.get('country') || '').toUpperCase(),
        personalised: url.searchParams.get('personalised') === '1',
        rules: config.rules,
      })
    )],
];

window.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url, window.location.href);
  if (url.origin === window.location.origin) {
    const handler = handlers.find(([pattern]) => pattern.test(url.pathname));
    if (handler) {
      const body = init.body ? JSON.parse(init.body) : {};
      return handler[1](url, body);
    }
  }
  return nativeFetch(input, init);
};
