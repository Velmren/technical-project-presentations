if (!customElements.get('sheaf-configurator')) {
  const MONOGRAM_FORBIDDEN = /[^\p{Lu}\p{Nd}&.\-]/gu;

  const formatMoney = (cents, format) => {
    const withDelimiters = (number, precision, thousands, decimal) => {
      const fixed = (number / 100).toFixed(precision);
      const [whole, fraction] = fixed.split('.');
      const grouped = whole.replace(/(\d)(?=(\d{3})+(?!\d))/g, `$1${thousands}`);
      return fraction ? grouped + decimal + fraction : grouped;
    };
    const pattern = /\{\{\s*(\w+)\s*\}\}/;
    const kind = (format.match(pattern) || [])[1];
    const value =
      {
        amount: withDelimiters(cents, 2, ',', '.'),
        amount_no_decimals: withDelimiters(cents, 0, ',', '.'),
        amount_with_comma_separator: withDelimiters(cents, 2, '.', ','),
        amount_no_decimals_with_comma_separator: withDelimiters(cents, 0, '.', ','),
        amount_with_apostrophe_separator: withDelimiters(cents, 2, "'", '.'),
        amount_no_decimals_with_space_separator: withDelimiters(cents, 0, ' ', ','),
        amount_with_space_separator: withDelimiters(cents, 2, ' ', ','),
      }[kind] || withDelimiters(cents, 2, ',', '.');
    return format.replace(pattern, value);
  };

  customElements.define(
    'sheaf-configurator',
    class SheafConfigurator extends HTMLElement {
      connectedCallback() {
        this.data = JSON.parse(this.querySelector('[data-product-json]').textContent);
        this.strings = this.data.strings;
        this.moneyFormat = this.dataset.moneyFormat || '{{amount}}';
        this.monogramMax = Number(this.dataset.monogramMax) || 3;

        this.stage = this.querySelector('[data-stage]');
        this.form = this.querySelector('form');
        this.variantInput = this.querySelector('[data-variant-id]');
        // The hidden input is off until the script runs: without JavaScript the <noscript> select sends the variant.
        this.variantInput.disabled = false;
        this.optionFields = [...this.querySelectorAll('[data-option-index]')];
        this.monogramInput = this.querySelector('[data-monogram-input]');
        this.monogramField = this.querySelector('[data-monogram]');
        this.monogramPreview = this.querySelector('[data-monogram-preview]');
        this.quantityInput = this.querySelector('[data-quantity]');
        this.submitButton = this.querySelector('[data-submit]');
        this.message = this.querySelector('[data-message]');

        this.addEventListener('change', (event) => this.onChange(event));
        this.addEventListener('click', (event) => this.onClick(event));
        this.monogramInput?.addEventListener('input', () => this.onMonogramInput());
        this.form.addEventListener('submit', (event) => this.onSubmit(event));

        this.update({ silent: true });
      }

      get selectedOptions() {
        return this.optionFields.map((field) => field.querySelector('input:checked')?.value);
      }

      get monogram() {
        return this.monogramInput ? this.monogramInput.value : '';
      }

      get quantity() {
        return Math.max(1, Math.min(99, parseInt(this.quantityInput.value, 10) || 1));
      }

      findVariant(options) {
        return this.data.variants.find((variant) => variant.options.every((value, index) => value === options[index]));
      }

      onChange(event) {
        const input = event.target;
        if (input.matches('[data-quantity]')) {
          input.value = this.quantity;
          this.update();
          return;
        }
        if (!input.matches('.sheaf__radio')) return;

        const field = input.closest('.sheaf__field');
        if (field?.querySelector('[data-paper]')) {
          this.setView('inside');
        } else if (!input.dataset.dims) {
          this.setView('cover');
        }
        this.update();
      }

      onClick(event) {
        const view = event.target.closest('[data-view]');
        if (view && view.matches('button')) {
          this.setView(view.dataset.view);
          return;
        }
        const step = event.target.closest('[data-step]');
        if (step) {
          this.quantityInput.value = Math.max(1, Math.min(99, this.quantity + Number(step.dataset.step)));
          this.update();
        }
      }

      onMonogramInput() {
        const input = this.monogramInput;
        const clean = input.value.toUpperCase().replace(MONOGRAM_FORBIDDEN, '').slice(0, this.monogramMax);
        if (clean !== input.value) input.value = clean;

        this.setView('cover');
        this.monogramPreview.classList.remove('is-stamped');
        void this.monogramPreview.offsetWidth;
        this.monogramPreview.classList.add('is-stamped');
        this.update();
      }

      setView(view) {
        if (this.stage.dataset.view === view) return;
        this.stage.dataset.view = view;
        this.querySelectorAll('button[data-view]').forEach((button) => {
          button.setAttribute('aria-pressed', String(button.dataset.view === view));
        });
      }

      update({ silent = false } = {}) {
        const options = this.selectedOptions;
        this.variant = this.findVariant(options);

        this.updateAvailability(options);
        this.updatePreview();
        this.updateSummary();

        if (this.variant) this.variantInput.value = this.variant.id;
        if (silent) return;

        this.hideMessage();
        if (this.variant && this.dataset.updateUrl === 'true') {
          const url = new URL(window.location.href);
          url.searchParams.set('variant', this.variant.id);
          window.history.replaceState({}, '', url);
        }
        this.announce();
      }

      updateAvailability(options) {
        this.optionFields.forEach((field, index) => {
          field.querySelector('[data-option-value]').textContent = options[index];
          field.querySelectorAll('input').forEach((input) => {
            const candidate = [...options];
            candidate[index] = input.value;
            const variant = this.findVariant(candidate);
            input.classList.toggle('is-unavailable', !variant || !variant.available);
          });
        });
      }

      updatePreview() {
        const style = this.stage.style;
        const checked = (selector) => this.querySelector(`${selector}:checked`);

        const cover = this.optionFields
          .map((field) => field.querySelector('input:checked'))
          .find((input) => input?.dataset.hex);
        if (cover) style.setProperty('--cover', cover.dataset.hex);

        const size = checked('input[data-dims]');
        if (size) {
          const [width, height] = size.dataset.dims.split('x').map(Number);
          style.setProperty('--w', width);
          style.setProperty('--h', height);
          this.querySelectorAll('[data-dims-label], [data-colophon-size]').forEach((label) => {
            label.textContent = `${width} × ${height}`;
          });
        }

        const paper = checked('input[data-paper]');
        if (paper) this.stage.dataset.paper = paper.dataset.paper;

        const band = checked('[data-band] input');
        if (band) {
          style.setProperty('--band', band.dataset.hex);
          this.querySelector('[data-band-value]').textContent = band.value;
        }

        const foil = checked('input[data-foil]');
        if (foil) this.stage.dataset.foil = foil.dataset.foil;

        if (this.monogramPreview) this.monogramPreview.textContent = this.monogram;
        this.monogramField?.classList.toggle('has-monogram', this.monogram !== '');
      }

      updateSummary() {
        const variant = this.variant;
        const addon = this.monogram && this.data.addon ? this.data.addon : null;
        const label = this.querySelector('[data-submit-label]');
        const total = this.querySelector('[data-total]');

        const addonRow = this.querySelector('[data-summary-addon]');
        if (addonRow) {
          addonRow.hidden = !addon;
          addonRow.querySelector('[data-summary-monogram]').textContent = this.monogram;
        }

        if (!variant) {
          this.submitButton.disabled = true;
          label.textContent = this.strings.unavailable;
          total.textContent = '';
          return;
        }

        this.querySelector('[data-summary-title]').textContent = variant.title;
        this.querySelector('[data-summary-price]').textContent = formatMoney(variant.price, this.moneyFormat);

        const unit = variant.price + (addon ? addon.price : 0);
        total.textContent = formatMoney(unit * this.quantity, this.moneyFormat);
        this.submitButton.disabled = !variant.available;
        label.textContent = variant.available ? this.strings.addToCart : this.strings.soldOut;
      }

      announce() {
        document.dispatchEvent(
          new CustomEvent('sheaf:change', {
            detail: {
              sectionId: this.dataset.sectionId,
              variantId: this.variant ? this.variant.id : null,
              available: Boolean(this.variant && this.variant.available),
              personalised: this.monogram !== '',
            },
          })
        );
      }

      buildItems() {
        const properties = {};
        new FormData(this.form).forEach((value, key) => {
          const match = key.match(/^properties\[(.+)\]$/);
          if (match && value !== '') properties[match[1]] = value;
        });

        const foilInput = this.querySelector('input[data-foil]');
        if (!this.monogram && foilInput) {
          delete properties[foilInput.name.match(/^properties\[(.+)\]$/)[1]];
        }

        const items = [{ id: this.variant.id, quantity: this.quantity, properties }];

        if (this.monogram && this.data.addon) {
          const set = `${this.variant.id}-${Date.now().toString(36)}`;
          properties._set = set;
          items.push({
            id: this.data.addon.id,
            quantity: this.quantity,
            properties: {
              [this.strings.monogramFor]: `${this.data.title} / ${this.variant.title}: ${this.monogram}`,
              _set: set,
              _addon: '1',
            },
          });
        }
        return items;
      }

      async onSubmit(event) {
        event.preventDefault();
        if (!this.variant || !this.variant.available || this.submitButton.getAttribute('aria-busy') === 'true') return;

        this.hideMessage();
        this.submitButton.setAttribute('aria-busy', 'true');

        const cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
        const body = { items: this.buildItems() };
        if (cart) {
          body.sections = cart.getSectionsToRender().map((section) => section.id);
          body.sections_url = window.location.pathname;
          cart.setActiveElement?.(document.activeElement);
        }

        try {
          const response = await fetch(`${this.dataset.cartAddUrl}.js`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(body),
          });
          const result = await response.json();

          if (!response.ok || result.status) {
            this.showMessage(result.description || result.message || this.strings.error, true);
            return;
          }

          const line = result.items ? result.items[0] : result;
          if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
            publish(PUB_SUB_EVENTS.cartUpdate, {
              source: 'sheaf-configurator',
              productVariantId: this.variant.id,
              cartData: result,
            });
          }

          if (cart && result.sections) {
            cart.renderContents({ ...line, sections: result.sections });
          } else {
            this.showAdded();
          }
        } catch (error) {
          this.showMessage(this.strings.error, true);
        } finally {
          this.submitButton.removeAttribute('aria-busy');
        }
      }

      showAdded() {
        this.message.textContent = `${this.strings.added} `;
        const link = document.createElement('a');
        link.href = this.dataset.cartUrl;
        link.textContent = this.strings.viewCart;
        this.message.append(link);
        this.message.classList.remove('is-error');
        this.message.hidden = false;
      }

      showMessage(text, isError) {
        this.message.textContent = text;
        this.message.classList.toggle('is-error', Boolean(isError));
        this.message.hidden = false;
      }

      hideMessage() {
        this.message.hidden = true;
      }
    }
  );
}
