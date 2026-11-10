(function () {
  const DEFAULT_DELAY = 5000;

  function initAnnouncementBar(announcementBar) {
    if (announcementBar.dataset.jpAnnReady === 'true') return;
    const slides = announcementBar.querySelectorAll('[data-jp-ann-slide]');
    if (slides.length < 2) return;
    announcementBar.dataset.jpAnnReady = 'true';

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
      if (announcementBar.dataset.autoplay !== 'true') return;
      /* do not rotate while the pointer or keyboard focus is on the bar */
      if (announcementBar.matches(':hover') || announcementBar.contains(document.activeElement)) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      stopAutoplay();
      autoplayTimer = setInterval(function () {
        /* stop when the section was removed or re-rendered (theme editor) */
        if (!announcementBar.isConnected) {
          stopAutoplay();
          return;
        }
        showSlide(activeIndex + 1);
      }, parseInt(announcementBar.dataset.delay, 10) || DEFAULT_DELAY);
    }

    const previousButton = announcementBar.querySelector('[data-jp-ann-prev]');
    const nextButton = announcementBar.querySelector('[data-jp-ann-next]');

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
    announcementBar.addEventListener('mouseenter', stopAutoplay);
    announcementBar.addEventListener('mouseleave', startAutoplay);
    announcementBar.addEventListener('focusin', stopAutoplay);
    announcementBar.addEventListener('focusout', startAutoplay);
    startAutoplay();
  }

  function initAllAnnouncementBars() {
    document.querySelectorAll('[data-jp-ann]').forEach(initAnnouncementBar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllAnnouncementBars);
  } else {
    initAllAnnouncementBars();
  }
  document.addEventListener('shopify:section:load', initAllAnnouncementBars);
})();
