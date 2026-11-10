(function () {
  function readQuantity(quantityInput) {
    return parseInt(quantityInput.value, 10) || 1;
  }

  function initFeaturedProduct(featuredProductRoot) {
    if (featuredProductRoot.dataset.jpFpReady === 'true') return;
    featuredProductRoot.dataset.jpFpReady = 'true';

    const variantsScript = featuredProductRoot.querySelector('[data-jp-fp-variants]');
    const variants = variantsScript ? JSON.parse(variantsScript.textContent) : [];
    const optionSelects = Array.prototype.slice.call(
      featuredProductRoot.querySelectorAll('[data-jp-fp-option]')
    );
    const variantIdInput = featuredProductRoot.querySelector('[data-jp-fp-id]');
    const priceElement = featuredProductRoot.querySelector('[data-jp-fp-price]');
    const compareAtPriceElement = featuredProductRoot.querySelector('[data-jp-fp-compare]');
    const submitButton = featuredProductRoot.querySelector('[data-jp-fp-submit]');
    const quantityInput = featuredProductRoot.querySelector('[data-jp-fp-qty]');
    const minusButton = featuredProductRoot.querySelector('[data-jp-fp-minus]');
    const plusButton = featuredProductRoot.querySelector('[data-jp-fp-plus]');

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

    function updateVariant() {
      if (!optionSelects.length) return;

      const selectedVariant = findSelectedVariant();
      if (!selectedVariant) {
        submitButton.disabled = true;
        submitButton.textContent = submitButton.dataset.soldout;
        return;
      }

      variantIdInput.value = selectedVariant.id;
      priceElement.textContent = selectedVariant.price_formatted;

      if (selectedVariant.compare_at_price && selectedVariant.compare_at_price > selectedVariant.price) {
        compareAtPriceElement.textContent = selectedVariant.compare_formatted;
        compareAtPriceElement.hidden = false;
      } else {
        compareAtPriceElement.hidden = true;
      }

      submitButton.disabled = !selectedVariant.available;
      submitButton.textContent = selectedVariant.available
        ? submitButton.dataset.label
        : submitButton.dataset.soldout;
    }

    optionSelects.forEach(function (optionSelect) {
      optionSelect.addEventListener('change', updateVariant);
    });

    if (quantityInput) {
      if (minusButton) {
        minusButton.addEventListener('click', function () {
          quantityInput.value = Math.max(1, readQuantity(quantityInput) - 1);
        });
      }
      if (plusButton) {
        plusButton.addEventListener('click', function () {
          quantityInput.value = readQuantity(quantityInput) + 1;
        });
      }
      quantityInput.addEventListener('change', function () {
        quantityInput.value = Math.max(1, readQuantity(quantityInput));
      });
    }
  }

  function initAllFeaturedProducts() {
    document.querySelectorAll('[data-jp-fp]').forEach(initFeaturedProduct);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllFeaturedProducts);
  } else {
    initAllFeaturedProducts();
  }
  document.addEventListener('shopify:section:load', initAllFeaturedProducts);
})();
