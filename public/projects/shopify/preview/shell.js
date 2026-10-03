// Page frame of the preview: cart counter, country and language switches, cart page.
// It plays the part of the theme's own header, footer and cart-items element.
(() => {
  const config = JSON.parse(document.getElementById('shell-config').textContent);
  const money = (cents) => {
    const [whole, fraction] = (cents / 100).toFixed(2).split('.');
    return config.moneyFormat.replace(/\{\{\s*\w+\s*\}\}/, `${whole.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.')},${fraction}`);
  };
  const cartUrl = (action) => `${config.routes.cart_url}${action}`;
  const fetchCart = async () => (await fetch(cartUrl('.js'), { headers: { Accept: 'application/json' } })).json();

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

  const cartPage = document.querySelector('[data-cart-lines]');

  function renderCart(cart) {
    document.querySelector('[data-cart-count]').textContent = cart.item_count;
    if (!cartPage) return;

    if (cart.items.length === 0) {
      cartPage.innerHTML = `<p>${escapeHtml(config.strings.empty)}</p>`;
      return;
    }

    const rows = cart.items
      .map((line) => {
        const properties = Object.entries(line.properties || {})
          .filter(([name]) => !name.startsWith('_'))
          .map(([name, value]) => `<dt>${escapeHtml(name)}:</dt><dd>${escapeHtml(value)}</dd>`)
          .join('');
        const title = escapeHtml(line.product_title);
        return `<tr>
          <td><span class="shell-cart__title">${title}</span>${line.variant_title ? `<div>${escapeHtml(line.variant_title)}</div>` : ''}${
            properties ? `<dl>${properties}</dl>` : ''
          }</td>
          <td>
            <div class="shell-cart__quantity" data-line="${escapeHtml(line.key)}" data-quantity="${line.quantity}">
              <button type="button" data-change="-1" aria-label="${escapeHtml(config.strings.decrease.replace('{{ product }}', line.product_title))}">−</button>
              <span>${line.quantity}</span>
              <button type="button" data-change="1" aria-label="${escapeHtml(config.strings.increase.replace('{{ product }}', line.product_title))}">+</button>
            </div>
            <button type="button" class="link shell-cart__remove" data-line="${escapeHtml(line.key)}" data-remove>${escapeHtml(config.strings.remove)}</button>
          </td>
          <td>${money(line.line_price)}</td>
        </tr>`;
      })
      .join('');

    cartPage.innerHTML = `<table class="shell-cart__table">
        <thead><tr><th>${escapeHtml(config.strings.product)}</th><th>${escapeHtml(config.strings.quantity)}</th><th>${escapeHtml(config.strings.total)}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="shell-cart__footer">
        <button type="button" class="button button--secondary" data-cart-clear>${escapeHtml(config.strings.clear)}</button>
        <p class="shell-cart__total">${escapeHtml(config.strings.estimatedTotal)}: ${money(cart.total_price)}</p>
      </div>`;
  }

  const refresh = async () => renderCart(await fetchCart());

  async function post(action, body) {
    await fetch(cartUrl(action), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
  }

  // A line changed on the cart page: announce it like Dawn's cart-items does, then redraw.
  async function changeLine(key, quantity) {
    await post('/change.js', { id: key, quantity });
    await publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items' });
    await refresh();
  }

  cartPage?.addEventListener('click', async (event) => {
    const remove = event.target.closest('[data-remove]');
    const change = event.target.closest('[data-change]');
    if (remove) {
      await changeLine(remove.dataset.line, 0);
    } else if (change) {
      const line = change.closest('[data-line]');
      await changeLine(line.dataset.line, Math.max(0, Number(line.dataset.quantity) + Number(change.dataset.change)));
    } else if (event.target.closest('[data-cart-clear]')) {
      await post('/clear.js', {});
      await refresh();
    }
  });

  document.querySelector('[data-country-select]').addEventListener('change', (event) => {
    document.cookie = `sheaf_country=${event.target.value}; path=/; max-age=31536000; SameSite=Lax`;
    window.location.reload();
  });

  const languageSelect = document.querySelector('[data-language-select]');
  const LANGUAGE_KEY = 'sheaf-demo-language';
  const remembered = () => {
    try {
      return window.localStorage.getItem(LANGUAGE_KEY);
    } catch (error) {
      return null;
    }
  };

  languageSelect.addEventListener('change', (event) => {
    try {
      window.localStorage.setItem(LANGUAGE_KEY, event.target.selectedOptions[0].dataset.locale);
    } catch (error) {
      // Without storage the choice simply lasts for this visit.
    }
    window.location.href = event.target.value + window.location.search;
  });

  // The published demo opens in the visitor's language the first time, like a store with language redirection.
  if (config.standalone && config.locale === config.defaultLocale && !remembered()) {
    const offered = [...languageSelect.options];
    const wanted = (navigator.languages || [navigator.language]).map((tag) => tag.slice(0, 2).toLowerCase());
    const match = wanted.map((code) => offered.find((entry) => entry.dataset.locale === code)).find(Boolean);
    if (match && match.dataset.locale !== config.locale) window.location.replace(match.value + window.location.search);
  }

  document.addEventListener('DOMContentLoaded', () => {
    subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      if (event && event.source === 'cart-items') return undefined;
      return refresh();
    });
    refresh();
  });
})();
