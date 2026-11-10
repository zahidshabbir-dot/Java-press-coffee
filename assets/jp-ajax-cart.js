/* Adds to cart without leaving the page and opens the cart drawer.
   Works for the forms in the jp- sections (best sellers, product, recommended, collection, featured). */
(() => {
  if (window.__jpAjaxCart) {
    return;
  }
  window.__jpAjaxCart = true;

  const getRouteRoot = () => (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    const formAction = form.getAttribute('action') || '';
    if (formAction.indexOf('/cart/add') === -1) {
      return;
    }
    if (!/jp-[a-z]+__form/.test(form.className || '')) {
      return;
    }

    const cartDrawer = document.querySelector('cart-drawer');
    if (!cartDrawer || typeof cartDrawer.renderContents !== 'function') {
      // fall back to the normal cart page
      return;
    }

    event.preventDefault();
    if (form.dataset.jpBusy === 'true') {
      return;
    }
    form.dataset.jpBusy = 'true';

    const submitButton = form.querySelector('[type="submit"]');
    /* remember the real label once, so a second click during the error message can't overwrite it */
    if (submitButton && !submitButton.dataset.jpLabel) {
      submitButton.dataset.jpLabel = submitButton.textContent;
    }
    const originalLabel = submitButton ? submitButton.dataset.jpLabel : '';
    if (submitButton) {
      submitButton.setAttribute('aria-busy', 'true');
      submitButton.style.opacity = '0.7';
      submitButton.style.pointerEvents = 'none';
    }

    const formData = new FormData(form);
    formData.append('sections', 'cart-drawer,cart-icon-bubble');
    formData.append('sections_url', window.location.pathname);

    fetch(`${getRouteRoot()}cart/add.js`, {
      method: 'POST',
      body: formData,
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/javascript'
      }
    })
      .then((response) => response.json())
      .then((cartState) => {
        if (cartState.status || !cartState.sections) {
          const errorMessage = cartState.description || cartState.message || 'Could not add this product to the cart.';
          if (submitButton) {
            submitButton.textContent = errorMessage;
            setTimeout(() => {
              submitButton.textContent = originalLabel;
            }, 2500);
          }
          return;
        }
        /* The product is already in the cart here. If drawing the drawer fails,
           open the cart page instead of submitting the form again (that would add it twice). */
        try {
          /* the first add from an empty cart: show the full drawer (header, count, close button) */
          cartDrawer.classList.remove('is-empty');
          /* lets the drawer return focus to the button when it closes */
          if (submitButton && typeof cartDrawer.setActiveElement === 'function') {
            cartDrawer.setActiveElement(submitButton);
          }
          cartDrawer.renderContents(cartState);
        } catch (error) {
          window.location.href = `${getRouteRoot()}cart`;
        }
      }, () => {
        /* The add request itself failed (network error or invalid response): use the normal form submit */
        form.dataset.jpBusy = 'false';
        form.submit();
      })
      .finally(() => {
        form.dataset.jpBusy = 'false';
        if (submitButton) {
          submitButton.removeAttribute('aria-busy');
          submitButton.style.opacity = '';
          submitButton.style.pointerEvents = '';
        }
      });
  });

  /* Save the chosen delivery date on the cart (order attribute "delivery_date").
     The current cart attributes are read first and sent back with the new date,
     so attributes added by other apps or scripts are kept. */
  document.addEventListener('change', (event) => {
    const dateInput = event.target;
    if (!dateInput || !dateInput.matches || !dateInput.matches('[data-jp-delivery-date]')) {
      return;
    }
    const deliveryDate = dateInput.value;

    fetch(`${getRouteRoot()}cart.js`, {
      headers: {
        Accept: 'application/json'
      }
    })
      .then((response) => response.json())
      .then((cart) => {
        const attributes = Object.assign({}, cart.attributes, { delivery_date: deliveryDate });
        return fetch(`${getRouteRoot()}cart/update.js`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({ attributes })
        });
      })
      .catch(() => {});
  });
})();
