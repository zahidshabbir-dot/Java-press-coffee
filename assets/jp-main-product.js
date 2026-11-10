/*
  JP Product (sections/jp-main-product.liquid)
  Image gallery, variant pickers and quantity buttons. Every [data-jp-mp] section on the page
  is set up once, on page load and again when the theme editor re-renders the section.
  Variant data comes from the <script type="application/json" data-jp-mp-variants> block.
*/
(function () {
  function initMainProduct(productRoot) {
    if (productRoot.dataset.jpMpReady) {
      return;
    }

    productRoot.dataset.jpMpReady = 'true';

    /* ---------- gallery ---------- */

    const slides = Array.prototype.slice.call(productRoot.querySelectorAll('[data-jp-mp-slide]'));
    const thumbButtons = Array.prototype.slice.call(productRoot.querySelectorAll('[data-jp-mp-thumb]'));
    let activeSlideIndex = 0;

    function showSlide(targetIndex) {
      if (!slides.length) {
        return;
      }

      activeSlideIndex = (targetIndex + slides.length) % slides.length;

      slides.forEach(function (slide, slideIndex) {
        slide.classList.toggle('is-active', slideIndex === activeSlideIndex);
      });

      thumbButtons.forEach(function (thumbButton, thumbIndex) {
        if (thumbIndex === activeSlideIndex) {
          thumbButton.setAttribute('aria-current', 'true');
        } else {
          thumbButton.removeAttribute('aria-current');
        }
      });
    }

    const previousButton = productRoot.querySelector('[data-jp-mp-prev]');
    const nextButton = productRoot.querySelector('[data-jp-mp-next]');

    if (previousButton) {
      previousButton.addEventListener('click', function () {
        showSlide(activeSlideIndex - 1);
      });
    }

    if (nextButton) {
      nextButton.addEventListener('click', function () {
        showSlide(activeSlideIndex + 1);
      });
    }

    thumbButtons.forEach(function (thumbButton) {
      thumbButton.addEventListener('click', function () {
        showSlide(parseInt(thumbButton.dataset.jpMpThumb, 10));
      });
    });

    /* ---------- variants ---------- */

    const variantsScript = productRoot.querySelector('[data-jp-mp-variants]');
    const variants = variantsScript ? JSON.parse(variantsScript.textContent) : [];
    const optionSelects = Array.prototype.slice.call(productRoot.querySelectorAll('[data-jp-mp-option]'));
    const variantIdInput = productRoot.querySelector('[data-jp-mp-id]');
    const priceElement = productRoot.querySelector('[data-jp-mp-price]');
    const comparePriceElement = productRoot.querySelector('[data-jp-mp-compare]');
    const submitButton = productRoot.querySelector('[data-jp-mp-submit]');
    const quantityInput = productRoot.querySelector('[data-jp-mp-qty]');

    function findSelectedVariant() {
      const selectedValues = optionSelects.map(function (optionSelect) {
        return optionSelect.value;
      });

      return variants.find(function (variant) {
        return selectedValues.every(function (selectedValue, optionIndex) {
          return variant.options[optionIndex] === selectedValue;
        });
      });
    }

    function onOptionChange() {
      if (!optionSelects.length) {
        return;
      }

      const selectedVariant = findSelectedVariant();

      if (!selectedVariant) {
        submitButton.disabled = true;
        submitButton.textContent = submitButton.dataset.soldout;
        return;
      }

      variantIdInput.value = selectedVariant.id;
      priceElement.textContent = selectedVariant.price_formatted;

      if (selectedVariant.compare_at_price && selectedVariant.compare_at_price > selectedVariant.price) {
        comparePriceElement.textContent = selectedVariant.compare_formatted;
        comparePriceElement.hidden = false;
      } else {
        comparePriceElement.hidden = true;
      }

      submitButton.disabled = !selectedVariant.available;
      submitButton.textContent = selectedVariant.available ? submitButton.dataset.label : submitButton.dataset.soldout;

      if (selectedVariant.featured_image && selectedVariant.featured_image.id) {
        const variantSlideIndex = slides.findIndex(function (slide) {
          return slide.dataset.mediaId === String(selectedVariant.featured_image.id);
        });

        if (variantSlideIndex > -1) {
          showSlide(variantSlideIndex);
        }
      }

      const pageUrl = new URL(window.location.href);
      pageUrl.searchParams.set('variant', selectedVariant.id);
      window.history.replaceState({}, '', pageUrl.toString());
    }

    optionSelects.forEach(function (optionSelect) {
      optionSelect.addEventListener('change', onOptionChange);
    });

    /* ---------- quantity ---------- */

    const decreaseButton = productRoot.querySelector('[data-jp-mp-minus]');
    const increaseButton = productRoot.querySelector('[data-jp-mp-plus]');

    function getQuantity() {
      return parseInt(quantityInput.value, 10) || 1;
    }

    if (quantityInput) {
      if (decreaseButton) {
        decreaseButton.addEventListener('click', function () {
          quantityInput.value = Math.max(1, getQuantity() - 1);
        });
      }

      if (increaseButton) {
        increaseButton.addEventListener('click', function () {
          quantityInput.value = getQuantity() + 1;
        });
      }

      quantityInput.addEventListener('change', function () {
        quantityInput.value = Math.max(1, getQuantity());
      });
    }
  }

  /* ---------- start ---------- */

  function initAllMainProducts(scope) {
    scope.querySelectorAll('[data-jp-mp]').forEach(initMainProduct);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initAllMainProducts(document);
    });
  } else {
    initAllMainProducts(document);
  }

  document.addEventListener('shopify:section:load', function (event) {
    initAllMainProducts(event.target);
  });
})();
