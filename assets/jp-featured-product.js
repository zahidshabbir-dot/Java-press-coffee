/*
  JP Featured product (sections/jp-featured-product.liquid)
  Sets up the buy box of every [data-jp-fp] section with the shared helpers in
  assets/jp-product-form.js, on page load and when the theme editor re-renders a section.
*/
(function () {
  function initFeaturedProduct(featuredProductRoot) {
    if (featuredProductRoot.dataset.jpFpReady === 'true') {
      return;
    }

    featuredProductRoot.dataset.jpFpReady = 'true';
    window.JpProductForm.init(featuredProductRoot, { prefix: 'jp-fp' });
  }

  function initAllFeaturedProducts() {
    if (!window.JpProductForm) {
      return;
    }

    document.querySelectorAll('[data-jp-fp]').forEach(initFeaturedProduct);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllFeaturedProducts);
  } else {
    initAllFeaturedProducts();
  }

  document.addEventListener('shopify:section:load', initAllFeaturedProducts);
})();
