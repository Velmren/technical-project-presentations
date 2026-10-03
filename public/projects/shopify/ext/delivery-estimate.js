if (!customElements.get('sheaf-delivery')) {
  customElements.define(
    'sheaf-delivery',
    class SheafDelivery extends HTMLElement {
      connectedCallback() {
        this.strings = JSON.parse(this.querySelector('[data-strings]').textContent);
        this.dispatchLine = this.querySelector('[data-dispatch]');
        this.arrivalLine = this.querySelector('[data-arrival]');
        this.personalised = false;
        this.clockOffset = 0;

        const locale = this.dataset.locale || document.documentElement.lang || 'en';
        this.dayFormat = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

        this.onChange = (event) => {
          const personalised = Boolean(event.detail && event.detail.personalised);
          if (personalised === this.personalised) return;
          this.personalised = personalised;
          this.load();
        };
        document.addEventListener('sheaf:change', this.onChange);

        this.load();
        this.timer = window.setInterval(() => this.tick(), 30_000);
      }

      disconnectedCallback() {
        document.removeEventListener('sheaf:change', this.onChange);
        window.clearInterval(this.timer);
        this.request?.abort();
      }

      async load() {
        this.request?.abort();
        this.request = new AbortController();

        const query = new URLSearchParams({
          country: this.dataset.country,
          personalised: this.personalised ? '1' : '0',
        });

        try {
          const response = await fetch(`${this.dataset.endpoint}?${query}`, {
            headers: { Accept: 'application/json' },
            signal: this.request.signal,
          });
          if (!response.ok) throw new Error(`Estimate request failed: ${response.status}`);
          this.estimate = await response.json();
          this.clockOffset = Date.parse(this.estimate.now) - Date.now();
          this.render();
        } catch (error) {
          if (error.name === 'AbortError') return;
          // The estimate is a convenience: without it the product form still works.
          this.hidden = true;
        }
      }

      tick() {
        if (!this.estimate || !this.estimate.shipsToday) return;
        if (this.remainingMinutes() <= 0) {
          this.load();
        } else {
          this.render();
        }
      }

      remainingMinutes() {
        const now = Date.now() + this.clockOffset;
        return Math.ceil((Date.parse(this.estimate.cutoff) - now) / 60_000);
      }

      formatDay(date) {
        return this.dayFormat.format(new Date(`${date}T00:00:00Z`));
      }

      formatRemaining(minutes) {
        const hours = Math.floor(minutes / 60);
        const parts = [];
        if (hours > 0) parts.push(this.strings.hours.replace('[count]', hours));
        if (minutes % 60 > 0 || hours === 0) parts.push(this.strings.minutes.replace('[count]', minutes % 60));
        return parts.join(' ');
      }

      render() {
        const estimate = this.estimate;
        const country = this.dataset.countryName || estimate.country;

        if (!estimate.shipsTo) {
          this.dispatchLine.textContent = this.strings.noShipping.replace('[country]', country);
          this.arrivalLine.textContent = '';
          this.hidden = false;
          return;
        }

        if (estimate.shipsToday) {
          this.dispatchLine.textContent = this.strings.orderWithin.replace('[time]', this.formatRemaining(this.remainingMinutes()));
        } else {
          const template = estimate.personalised ? this.strings.madeToOrder : this.strings.shipsOn;
          this.dispatchLine.textContent = template.replace('[date]', this.formatDay(estimate.dispatch));
        }

        this.arrivalLine.textContent = this.strings.arrivesBetween
          .replace('[from]', this.formatDay(estimate.arrives.from))
          .replace('[to]', this.formatDay(estimate.arrives.to))
          .replace('[country]', country);
        this.hidden = false;
      }
    }
  );
}
