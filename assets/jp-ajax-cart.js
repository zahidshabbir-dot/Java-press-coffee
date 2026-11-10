/* Adds to cart without leaving the page and opens the cart drawer.
   Works for the forms in the jp- sections (best sellers, product, recommended, collection, featured). */
(() => {
  if (window.__jpAjaxCart) return;
  window.__jpAjaxCart = true;

  const routeRoot = () => (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const action = form.getAttribute('action') || '';
    if (action.indexOf('/cart/add') === -1) return;
    if (!/jp-[a-z]+__form/.test(form.className || '')) return;

    const drawer = document.querySelector('cart-drawer');
    if (!drawer || typeof drawer.renderContents !== 'function') return; // fall back to the normal cart page

    event.preventDefault();
    if (form.dataset.jpBusy === 'true') return;
    form.dataset.jpBusy = 'true';

    const button = form.querySelector('[type="submit"]');
    /* remember the real label once, so a second click during the error message can't overwrite it */
    if (button && !button.dataset.jpLabel) button.dataset.jpLabel = button.textContent;
    const label = button ? button.dataset.jpLabel : '';
    if (button) {
      button.setAttribute('aria-busy', 'true');
      button.style.opacity = '0.7';
      button.style.pointerEvents = 'none';
    }

    const body = new FormData(form);
    body.append('sections', 'cart-drawer,cart-icon-bubble');
    body.append('sections_url', window.location.pathname);

    fetch(`${routeRoot()}cart/add.js`, {
      method: 'POST',
      body,
      headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/javascript' }
    })
      .then((response) => response.json())
      .then((state) => {
        if (state.status || !state.sections) {
          const msg = state.description || state.message || 'Could not add this product to the cart.';
          if (button) {
            button.textContent = msg;
            setTimeout(() => { button.textContent = label; }, 2500);
          }
          return;
        }
        /* The product is already in the cart here. If drawing the drawer fails,
           open the cart page instead of submitting the form again (that would add it twice). */
        try {
          /* the first add from an empty cart: show the full drawer (header, count, close button) */
          drawer.classList.remove('is-empty');
          /* lets the drawer return focus to the button when it closes */
          if (button && typeof drawer.setActiveElement === 'function') drawer.setActiveElement(button);
          drawer.renderContents(state);
        } catch (error) {
          window.location.href = `${routeRoot()}cart`;
        }
      }, () => {
        /* The add request itself failed (network error or invalid response): use the normal form submit */
        form.dataset.jpBusy = 'false';
        form.submit();
      })
      .finally(() => {
        form.dataset.jpBusy = 'false';
        if (button) {
          button.removeAttribute('aria-busy');
          button.style.opacity = '';
          button.style.pointerEvents = '';
        }
      });
  });

  /* Save the chosen delivery date on the cart (order attribute "delivery_date").
     The current cart attributes are read first and sent back with the new date,
     so attributes added by other apps or scripts are kept. */
  document.addEventListener('change', (event) => {
    const input = event.target;
    if (!input || !input.matches || !input.matches('[data-jp-delivery-date]')) return;
    const value = input.value;

    fetch(`${routeRoot()}cart.js`, { headers: { Accept: 'application/json' } })
      .then((response) => response.json())
      .then((cart) => {
        const attributes = Object.assign({}, cart.attributes, { delivery_date: value });
        return fetch(`${routeRoot()}cart/update.js`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ attributes })
        });
      })
      .catch(() => {});
  });
})();
