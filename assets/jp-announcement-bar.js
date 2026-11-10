(function () {
  const DEFAULT_DELAY = 5000;

  function initAnnouncementBar(root) {
    if (root.dataset.jpAnnReady === 'true') return;
    const slides = root.querySelectorAll('[data-jp-ann-slide]');
    if (slides.length < 2) return;
    root.dataset.jpAnnReady = 'true';

    let activeIndex = 0;
    let autoplayTimer = null;

    function showSlide(nextIndex) {
      slides[activeIndex].classList.remove('is-active');
      activeIndex = (nextIndex + slides.length) % slides.length;
      slides[activeIndex].classList.add('is-active');
    }

    function stopAutoplay() {
      if (autoplayTimer) {
        clearInterval(autoplayTimer);
        autoplayTimer = null;
      }
    }

    function startAutoplay() {
      if (root.dataset.autoplay !== 'true') return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      stopAutoplay();
      autoplayTimer = setInterval(function () {
        /* stop when the section was removed or re-rendered (theme editor) */
        if (!root.isConnected) {
          stopAutoplay();
          return;
        }
        showSlide(activeIndex + 1);
      }, parseInt(root.dataset.delay, 10) || DEFAULT_DELAY);
    }

    const previousButton = root.querySelector('[data-jp-ann-prev]');
    const nextButton = root.querySelector('[data-jp-ann-next]');

    if (previousButton) {
      previousButton.addEventListener('click', function () {
        showSlide(activeIndex - 1);
        startAutoplay();
      });
    }
    if (nextButton) {
      nextButton.addEventListener('click', function () {
        showSlide(activeIndex + 1);
        startAutoplay();
      });
    }
    root.addEventListener('mouseenter', stopAutoplay);
    root.addEventListener('mouseleave', startAutoplay);
    startAutoplay();
  }

  function initAll() {
    document.querySelectorAll('[data-jp-ann]').forEach(initAnnouncementBar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
  document.addEventListener('shopify:section:load', initAll);
})();
