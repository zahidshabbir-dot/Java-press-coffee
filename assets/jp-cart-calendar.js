/* Delivery date calendar for the cart drawer (Figma "Date-Picker").
   The calendar frame (buttons, labels, week days) is rendered by Liquid in snippets/cart-drawer.liquid.
   This script only updates the title, the day buttons and the selected value.
   It reads and writes the hidden input [data-jp-delivery-date]; jp-ajax-cart.js saves it on the cart. */
(() => {
  if (window.__jpCal) return;
  window.__jpCal = true;

  const pad = (n) => (n < 10 ? '0' : '') + n;
  const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const parse = (v) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
    return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
  };
  const isoOf = (date) => iso(date.y, date.m, date.d);
  const show = (d) => `${pad(d.d)} / ${pad(d.m + 1)} / ${d.y}`;
  const monthName = (y, m) => new Date(y, m, 1).toLocaleString(document.documentElement.lang || undefined, { month: 'long' });

  const render = (wrap, state) => {
    const panel = wrap.querySelector('.jp-cal');
    const days = panel.querySelector('[data-jp-cal-days]');
    const title = panel.querySelector('[data-jp-cal-title]');
    const prev = panel.querySelector('[data-jp-cal-prev]');
    const value = panel.querySelector('[data-jp-cal-value]');
    const setButton = panel.querySelector('[data-jp-cal-set]');
    if (!days || !title || !prev || !value || !setButton) return;

    const { y, m } = state.view;
    const minIso = isoOf(state.min);
    const lead = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
    const count = new Date(y, m + 1, 0).getDate();

    title.textContent = monthName(y, m) + (y !== new Date().getFullYear() ? ` ${y}` : '');
    prev.disabled = y < state.min.y || (y === state.min.y && m <= state.min.m);

    days.replaceChildren();
    for (let i = 0; i < lead; i++) days.appendChild(document.createElement('span'));
    for (let d = 1; d <= count; d++) {
      const dayIso = iso(y, m, d);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'jp-cal__day';
      button.dataset.jpCalDay = dayIso;
      button.textContent = d;
      button.disabled = dayIso < minIso;
      if (state.pick && dayIso === isoOf(state.pick)) button.classList.add('is-selected');
      days.appendChild(button);
    }

    value.textContent = state.pick ? show(state.pick) : value.dataset.empty;
    setButton.disabled = !state.pick;
  };

  const close = (wrap) => {
    const panel = wrap.querySelector('.jp-cal');
    if (panel) panel.hidden = true;
    const button = wrap.querySelector('[data-jp-cal-open]');
    if (button) button.setAttribute('aria-expanded', 'false');
    wrap.__jpState = null;
  };

  const open = (wrap) => {
    const input = wrap.querySelector('[data-jp-delivery-date]');
    const panel = wrap.querySelector('.jp-cal');
    if (!input || !panel) return;
    const today = new Date();
    const min = parse(input.dataset.min) || { y: today.getFullYear(), m: today.getMonth(), d: today.getDate() };
    const current = parse(input.value);
    const state = {
      min,
      pick: current && isoOf(current) >= isoOf(min) ? current : null,
      view: { y: (current || min).y, m: (current || min).m }
    };
    wrap.__jpState = state;
    render(wrap, state);
    panel.hidden = false;
    const button = wrap.querySelector('[data-jp-cal-open]');
    if (button) button.setAttribute('aria-expanded', 'true');
  };

  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!t.closest) return;
    const wrap = t.closest('[data-jp-cal]');

    // close any calendar when clicking elsewhere
    document.querySelectorAll('[data-jp-cal]').forEach((w) => { if (w !== wrap && w.__jpState) close(w); });

    if (!wrap) {
      // checkout needs a date?
      if (t.closest('#CartDrawer-Checkout')) {
        const input = document.querySelector('[data-jp-delivery-date]');
        if (input && input.dataset.required === 'true' && !input.value) {
          e.preventDefault();
          const field = input.closest('[data-jp-cal]');
          if (field) {
            field.classList.add('has-error');
            open(field);
          }
        }
      }
      return;
    }

    const state = wrap.__jpState;
    if (t.closest('[data-jp-cal-open]')) {
      e.preventDefault();
      if (state) close(wrap); else open(wrap);
      return;
    }
    if (!state) return;

    const day = t.closest('[data-jp-cal-day]');
    if (day && !day.disabled) {
      state.pick = parse(day.dataset.jpCalDay);
      render(wrap, state);
      return;
    }
    if (t.closest('[data-jp-cal-prev]')) {
      state.view.m--;
      if (state.view.m < 0) { state.view.m = 11; state.view.y--; }
      render(wrap, state);
      return;
    }
    if (t.closest('[data-jp-cal-next]')) {
      state.view.m++;
      if (state.view.m > 11) { state.view.m = 0; state.view.y++; }
      render(wrap, state);
      return;
    }
    if (t.closest('[data-jp-cal-set]') && state.pick) {
      const input = wrap.querySelector('[data-jp-delivery-date]');
      const label = wrap.querySelector('[data-jp-cal-label]');
      input.value = isoOf(state.pick);
      if (label) label.textContent = `${pad(state.pick.d)}/${pad(state.pick.m + 1)}/${state.pick.y}`;
      wrap.classList.remove('has-error');
      input.dispatchEvent(new Event('change', { bubbles: true }));
      close(wrap);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('[data-jp-cal]').forEach((w) => {
      if (w.__jpState) { close(w); e.stopPropagation(); }
    });
  }, true);
})();
