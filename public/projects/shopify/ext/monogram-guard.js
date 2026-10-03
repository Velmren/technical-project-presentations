// The monogram is sold as a separate cart line tied to its notebook by a shared
// `_set` property. This keeps the two in step: when the notebook is removed or
// its quantity changes in the cart, the monogram line follows.
if (!customElements.get('sheaf-cart-guard')) {
  const SOURCE = 'sheaf-cart-guard';

  customElements.define(
    'sheaf-cart-guard',
    class SheafCartGuard extends HTMLElement {
      connectedCallback() {
        this.busy = false;
        this.check();

        if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
          this.unsubscribe = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
            if (event && event.source === SOURCE) return undefined;
            return this.check();
          });
        }
      }

      disconnectedCallback() {
        this.unsubscribe?.();
      }

      static corrections(items) {
        const notebooks = new Map();
        for (const item of items) {
          const set = item.properties && item.properties._set;
          if (set && !item.properties._addon) notebooks.set(set, (notebooks.get(set) || 0) + item.quantity);
        }

        const updates = {};
        for (const item of items) {
          if (!item.properties || !item.properties._addon) continue;
          const wanted = notebooks.get(item.properties._set) || 0;
          if (item.quantity !== wanted) updates[item.key] = wanted;
        }
        return updates;
      }

      async check() {
        if (this.busy) {
          this.again = true;
          return;
        }
        this.busy = true;
        this.again = false;

        try {
          const cart = await (await fetch(`${this.dataset.cartUrl}.js`, { headers: { Accept: 'application/json' } })).json();
          const updates = SheafCartGuard.corrections(cart.items);
          if (Object.keys(updates).length === 0) return;

          const response = await fetch(`${this.dataset.cartUpdateUrl}.js`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ updates }),
          });
          if (!response.ok) return;

          if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
            publish(PUB_SUB_EVENTS.cartUpdate, { source: SOURCE, cartData: await response.json() });
          } else if (this.dataset.cartPage === 'true') {
            window.location.reload();
          }
        } catch (error) {
          // A failed check leaves the cart as it is; the next cart change tries again.
        } finally {
          this.busy = false;
          if (this.again) this.check();
        }
      }
    }
  );
}
