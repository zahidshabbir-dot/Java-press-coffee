/*
  Shared product form helpers for snippets/jp-product-info.liquid
  (used by JP Featured product and JP Product).
  window.JpProductForm.init(productRoot, options) wires the variant pickers, price, add to
  cart button and quantity stepper inside productRoot. Elements are found by data attributes
  that start with options.prefix ('jp-fp' or 'jp-mp'), e.g. [data-jp-fp-price].
  options.onVariantChange(selectedVariant) runs after a valid variant is picked.
  Load this file before the section script; both use defer, so they run in document order.
*/
(function () {
  if (window.JpProductForm) {
    return;
  }

  const MINIMUM_QUANTITY = 1;

  function readVariants(variantsScript) {
    if (!variantsScript) {
      return [];
    }

    try {
      const parsedVariants = JSON.parse(variantsScript.textContent);

      return Array.isArray(parsedVariants) ? parsedVariants : [];
    } catch (error) {
      console.error('JpProductForm: the variants JSON could not be read.', error);
      return [];
    }
  }

  function readQuantity(quantityInput) {
    return parseInt(quantityInput.value, 10) || MINIMUM_QUANTITY;
  }

  function findSelectedVariant(variants, optionSelects) {
    const selectedValues = optionSelects.map(function (optionSelect) {
      return optionSelect.value;
    });

    return variants.find(function (variant) {
      return selectedValues.every(function (selectedValue, optionIndex) {
        return variant.options[optionIndex] === selectedValue;
      });
    });
  }

  function updateVariantIdInput(variantIdInput, selectedVariant) {
    if (variantIdInput) {
      variantIdInput.value = selectedVariant.id;
    }
  }

  function updatePrice(priceElement, compareAtPriceElement, selectedVariant) {
    if (priceElement) {
      priceElement.textContent = selectedVariant.price_formatted;
    }

    if (!compareAtPriceElement) {
      return;
    }

    const isOnSale = Boolean(selectedVariant.compare_at_price)
      && selectedVariant.compare_at_price > selectedVariant.price;

    if (isOnSale) {
      compareAtPriceElement.textContent = selectedVariant.compare_formatted;
    }

    compareAtPriceElement.hidden = !isOnSale;
  }

  function updateSubmitButton(submitButton, selectedVariant) {
    if (!submitButton) {
      return;
    }

    const isAvailable = Boolean(selectedVariant && selectedVariant.available);

    submitButton.disabled = !isAvailable;
    submitButton.textContent = isAvailable
      ? submitButton.dataset.label
      : submitButton.dataset.soldout;
  }

  function initQuantityStepper(quantityInput, decreaseButton, increaseButton) {
    if (!quantityInput) {
      return;
    }

    if (decreaseButton) {
      decreaseButton.addEventListener('click', function () {
        quantityInput.value = Math.max(MINIMUM_QUANTITY, readQuantity(quantityInput) - 1);
      });
    }

    if (increaseButton) {
      increaseButton.addEventListener('click', function () {
        quantityInput.value = readQuantity(quantityInput) + 1;
      });
    }

    quantityInput.addEventListener('change', function () {
      quantityInput.value = Math.max(MINIMUM_QUANTITY, readQuantity(quantityInput));
    });
  }

  function init(productRoot, options) {
    const prefix = options.prefix;
    const onVariantChange = options.onVariantChange;

    function findElement(attributeSuffix) {
      return productRoot.querySelector('[data-' + prefix + '-' + attributeSuffix + ']');
    }

    const variants = readVariants(findElement('variants'));
    const optionSelects = Array.from(
      productRoot.querySelectorAll('[data-' + prefix + '-option]')
    );
    const variantIdInput = findElement('id');
    const priceElement = findElement('price');
    const compareAtPriceElement = findElement('compare');
    const submitButton = findElement('submit');

    function onOptionChange() {
      const selectedVariant = findSelectedVariant(variants, optionSelects);

      if (!selectedVariant) {
        updateSubmitButton(submitButton, null);
        return;
      }

      updateVariantIdInput(variantIdInput, selectedVariant);
      updatePrice(priceElement, compareAtPriceElement, selectedVariant);
      updateSubmitButton(submitButton, selectedVariant);

      if (typeof onVariantChange === 'function') {
        onVariantChange(selectedVariant);
      }
    }

    optionSelects.forEach(function (optionSelect) {
      optionSelect.addEventListener('change', onOptionChange);
    });

    initQuantityStepper(findElement('qty'), findElement('minus'), findElement('plus'));
  }

  window.JpProductForm = {
    init: init,
    findSelectedVariant: findSelectedVariant,
    readQuantity: readQuantity,
    readVariants: readVariants
  };
})();
