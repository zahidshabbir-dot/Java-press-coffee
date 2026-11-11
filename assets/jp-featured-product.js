/*
  JP Featured product (sections/jp-featured-product.liquid)
  Sets up the buy box of every [data-jp-fp] section with the shared helpers in
  assets/jp-product-form.js, on page load and when the theme editor re-renders a section.
*/
(function () {
  function initFeaturedProduct(featuredProductRoot) {
    if (!window.JpProductForm) {
      return;
    }

    if (featuredProductRoot.dataset.jpFpReady === 'true') {
      return;
    }

    featuredProductRoot.dataset.jpFpReady = 'true';
    window.JpProductForm.init(featuredProductRoot, { prefix: 'jp-fp' });
  }

  window.JpSections.onSectionReady('[data-jp-fp]', initFeaturedProduct);
})();
