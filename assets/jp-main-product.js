/*
  JP Product (sections/jp-main-product.liquid)
  Image gallery, plus the buy box through the shared helpers in assets/jp-product-form.js.
  Every [data-jp-mp] section on the page is set up once, on page load and again when the
  theme editor re-renders the section. Picking a variant shows its image and puts its id in
  the page URL.
*/
(function () {
  function initMainProduct(productRoot) {
    if (!window.JpProductForm) {
      return;
    }

    if (productRoot.dataset.jpMpReady) {
      return;
    }

    productRoot.dataset.jpMpReady = 'true';

    /* ---------- gallery ---------- */

    const slides = Array.from(productRoot.querySelectorAll('[data-jp-mp-slide]'));
    const thumbButtons = Array.from(productRoot.querySelectorAll('[data-jp-mp-thumb]'));
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
        const thumbSlideIndex = parseInt(thumbButton.dataset.jpMpThumb, 10);

        if (Number.isNaN(thumbSlideIndex)) {
          return;
        }

        showSlide(thumbSlideIndex);
      });
    });

    /* ---------- variant change ---------- */

    function showVariantImage(selectedVariant) {
      if (!selectedVariant.featured_image || !selectedVariant.featured_image.id) {
        return;
      }

      const variantImageId = String(selectedVariant.featured_image.id);
      const variantSlideIndex = slides.findIndex(function (slide) {
        return slide.dataset.mediaId === variantImageId;
      });

      if (variantSlideIndex > -1) {
        showSlide(variantSlideIndex);
      }
    }

    function updatePageUrl(selectedVariant) {
      const pageUrl = new URL(window.location.href);

      pageUrl.searchParams.set('variant', selectedVariant.id);
      window.history.replaceState(window.history.state, '', pageUrl.toString());
    }

    window.JpProductForm.init(productRoot, {
      prefix: 'jp-mp',
      onVariantChange: function (selectedVariant) {
        showVariantImage(selectedVariant);
        updatePageUrl(selectedVariant);
      }
    });
  }

  /* ---------- start ---------- */

  window.JpSections.onSectionReady('[data-jp-mp]', initMainProduct);
})();
