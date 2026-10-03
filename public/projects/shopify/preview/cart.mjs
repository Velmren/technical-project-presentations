// Cart rules of the preview, shared by the local server and the standalone demo.
// The cart is a plain array of lines shaped like the lines of Shopify's /cart.js.

function digest(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function cartState(cart, currency) {
  return {
    item_count: cart.reduce((sum, line) => sum + line.quantity, 0),
    total_price: cart.reduce((sum, line) => sum + line.line_price, 0),
    currency,
    items: cart,
  };
}

/**
 * Adds items the way /cart/add.js does: all or nothing, identical lines merge.
 * `findVariant(id)` returns { product, variant } or null.
 */
export function addItems(cart, items, findVariant) {
  const lines = items.map((item) => {
    const found = findVariant(item.id);
    if (!found) return { error: { status: 404, message: 'Cart Error', description: 'Cannot find variant' } };
    if (!found.variant.available) {
      const description = `${found.product.title} - ${found.variant.title} is sold out.`;
      return { error: { status: 422, message: 'Cart Error', description } };
    }
    const properties = item.properties || {};
    return {
      found,
      properties,
      quantity: Math.max(1, Number(item.quantity) || 1),
      key: `${found.variant.id}:${digest(JSON.stringify(properties))}`,
    };
  });

  const failed = lines.find((line) => line.error);
  if (failed) return failed;

  return {
    items: lines.map(({ found, quantity, properties, key }) => {
      const hasVariants = found.product.variants.length > 1;
      let line = cart.find((candidate) => candidate.key === key);
      if (!line) {
        line = {
          id: found.variant.id,
          variant_id: found.variant.id,
          key,
          title: hasVariants ? `${found.product.title} - ${found.variant.title}` : found.product.title,
          product_title: found.product.title,
          variant_title: hasVariants ? found.variant.title : null,
          price: found.variant.price,
          quantity: 0,
          line_price: 0,
          properties,
          url: `${found.product.url}?variant=${found.variant.id}`,
        };
        cart.push(line);
      }
      line.quantity += quantity;
      line.line_price = line.price * line.quantity;
      return line;
    }),
  };
}

/** Sets line quantities by key, as /cart/change.js and /cart/update.js do; zero removes the line. */
export function updateLines(cart, updates) {
  for (const [key, quantity] of Object.entries(updates)) {
    const line = cart.find((candidate) => candidate.key === key);
    if (!line) continue;
    line.quantity = Math.max(0, Number(quantity) || 0);
    line.line_price = line.price * line.quantity;
  }
  cart.splice(0, cart.length, ...cart.filter((line) => line.quantity > 0));
  return cart;
}
