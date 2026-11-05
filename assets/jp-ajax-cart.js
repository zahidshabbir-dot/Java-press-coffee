/* Adds to cart without leaving the page and opens the cart drawer.
   Works for the forms in the jp- sections (best sellers, product, recommended, collection, featured). */
(function () {
  if (window.__jpAjaxCart) return;
  window.__jpAjaxCart = true;

  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    var action = form.getAttribute('action') || '';
    if (action.indexOf('/cart/add') === -1) return;
    if (!/jp-[a-z]+__form/.test(form.className || '')) return;

    var drawer = document.querySelector('cart-drawer');
    if (!drawer || typeof drawer.renderContents !== 'function') return; // fall back to the normal cart page

    event.preventDefault();
    if (form.dataset.jpBusy === 'true') return;
    form.dataset.jpBusy = 'true';

    var button = form.querySelector('[type="submit"]');
    var label = button ? button.textContent : '';
    if (button) { button.setAttribute('aria-busy', 'true'); button.style.opacity = '0.7'; button.style.pointerEvents = 'none'; }

    var body = new FormData(form);
    body.append('sections', 'cart-drawer,cart-icon-bubble');
    body.append('sections_url', window.location.pathname);

    var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
    fetch(root + 'cart/add.js', {
      method: 'POST',
      body: body,
      headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/javascript' }
    })
      .then(function (response) { return response.json(); })
      .then(function (state) {
        if (state.status || !state.sections) {
          var msg = state.description || state.message || 'Could not add this product to the cart.';
          if (button) { button.textContent = msg; setTimeout(function () { button.textContent = label; }, 2500); }
          return;
        }
        drawer.renderContents(state);
      })
      .catch(function () { form.dataset.jpBusy = 'false'; form.submit(); })
      .finally(function () {
        form.dataset.jpBusy = 'false';
        if (button) { button.removeAttribute('aria-busy'); button.style.opacity = ''; button.style.pointerEvents = ''; }
      });
  });

  /* Save the chosen delivery date on the cart (order attribute "delivery_date") */
  document.addEventListener('change', function (event) {
    var input = event.target;
    if (!input || !input.matches || !input.matches('[data-jp-delivery-date]')) return;
    var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
    fetch(root + 'cart/update.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ attributes: { delivery_date: input.value } })
    }).catch(function () {});
  });
})();
