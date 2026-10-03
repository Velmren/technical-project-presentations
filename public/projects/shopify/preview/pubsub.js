// Stand-in for the theme's publish/subscribe helpers in the standalone demo,
// with the same names and behaviour the section and the app embed expect.
const PUB_SUB_EVENTS = {
  cartUpdate: 'cart-update',
  variantChange: 'variant-change',
  cartError: 'cart-error',
};

const subscribers = new Map();

function subscribe(eventName, callback) {
  if (!subscribers.has(eventName)) subscribers.set(eventName, new Set());
  subscribers.get(eventName).add(callback);
  return () => subscribers.get(eventName).delete(callback);
}

function publish(eventName, data) {
  const callbacks = [...(subscribers.get(eventName) || [])];
  return Promise.all(callbacks.map((callback) => callback(data)));
}
