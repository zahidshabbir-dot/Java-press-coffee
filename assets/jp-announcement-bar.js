(function () {
  const DEFAULT_AUTOPLAY_DELAY_MS = 5000;
  const ANNOUNCEMENT_BAR_SELECTOR = '[data-jp-ann]';
  const SLIDE_SELECTOR = '[data-jp-ann-slide]';
  const PREVIOUS_BUTTON_SELECTOR = '[data-jp-ann-prev]';
  const NEXT_BUTTON_SELECTOR = '[data-jp-ann-next]';
  const ACTIVE_CLASS = 'is-active';
  const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

  function initAnnouncementBar(announcementBar) {
    if (announcementBar.dataset.jpAnnReady === 'true') {
      return;
    }
    const slides = announcementBar.querySelectorAll(SLIDE_SELECTOR);
    if (slides.length < 2) {
      return;
    }
    announcementBar.dataset.jpAnnReady = 'true';

    const autoplayDelayMs =
      parseInt(announcementBar.dataset.delay, 10) || DEFAULT_AUTOPLAY_DELAY_MS;
    let activeSlideIndex = 0;
    let autoplayIntervalId = null;

    function showSlide(targetIndex) {
      slides[activeSlideIndex].classList.remove(ACTIVE_CLASS);
      activeSlideIndex = (targetIndex + slides.length) % slides.length;
      slides[activeSlideIndex].classList.add(ACTIVE_CLASS);
    }

    function stopAutoplay() {
      if (autoplayIntervalId) {
        clearInterval(autoplayIntervalId);
        autoplayIntervalId = null;
      }
    }

    function isUserOnBar() {
      return (
        announcementBar.matches(':hover') ||
        announcementBar.contains(document.activeElement)
      );
    }

    function startAutoplay() {
      if (announcementBar.dataset.autoplay !== 'true') {
        return;
      }
      /* do not rotate while the pointer or keyboard focus is on the bar */
      if (isUserOnBar()) {
        return;
      }
      if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
        return;
      }
      stopAutoplay();
      autoplayIntervalId = setInterval(function () {
        /* stop when the section was removed or re-rendered (theme editor) */
        if (!announcementBar.isConnected) {
          stopAutoplay();
          return;
        }
        showSlide(activeSlideIndex + 1);
      }, autoplayDelayMs);
    }

    const previousButton = announcementBar.querySelector(PREVIOUS_BUTTON_SELECTOR);
    const nextButton = announcementBar.querySelector(NEXT_BUTTON_SELECTOR);

    if (previousButton) {
      previousButton.addEventListener('click', function () {
        showSlide(activeSlideIndex - 1);
        startAutoplay();
      });
    }
    if (nextButton) {
      nextButton.addEventListener('click', function () {
        showSlide(activeSlideIndex + 1);
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
    document.querySelectorAll(ANNOUNCEMENT_BAR_SELECTOR).forEach(initAnnouncementBar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllAnnouncementBars);
  } else {
    initAllAnnouncementBars();
  }
  document.addEventListener('shopify:section:load', initAllAnnouncementBars);
})();
