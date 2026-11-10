(function () {
  const RESIZE_DEBOUNCE_MS = 150;
  /* a card that is this close to fitting still counts as a whole card on the page */
  const CARD_FIT_TOLERANCE_PX = 1;
  /* scroll positions this close to the end count as the last page */
  const SCROLL_END_TOLERANCE_PX = 2;
  const DEFAULT_TAB_ID = '1';
  const PAGE_NUMBER_TOKEN = '{page}';

  function initBestSellers(bestSellersRoot) {
    if (bestSellersRoot.dataset.jpBsReady === 'true') {
      return;
    }

    const trackElement = bestSellersRoot.querySelector('[data-jp-bs-track]');
    const dotsContainer = bestSellersRoot.querySelector('[data-jp-bs-dots]');
    const previousButton = bestSellersRoot.querySelector('[data-jp-bs-prev]');
    const nextButton = bestSellersRoot.querySelector('[data-jp-bs-next]');

    if (!trackElement || !dotsContainer || !previousButton || !nextButton) {
      return;
    }

    bestSellersRoot.dataset.jpBsReady = 'true';

    const productCards = Array.from(bestSellersRoot.querySelectorAll('[data-jp-bs-card]'));
    const tabButtons = Array.from(bestSellersRoot.querySelectorAll('[data-jp-bs-tab]'));
    const hasTabs = tabButtons.length > 0;
    const dotLabelTemplate = dotsContainer.dataset.dotLabel || PAGE_NUMBER_TOKEN;
    let dotButtons = [];
    let resizeDebounceTimeoutId = null;
    let isScrollUpdateQueued = false;

    function getVisibleCards() {
      return productCards.filter(function (productCard) {
        return !productCard.hidden;
      });
    }

    function getCardStepWidthPx() {
      const visibleCards = getVisibleCards();

      if (visibleCards.length > 1) {
        const distanceBetweenCards = Math.abs(
          visibleCards[1].offsetLeft - visibleCards[0].offsetLeft
        );

        return distanceBetweenCards || visibleCards[0].offsetWidth;
      }

      return visibleCards.length ? visibleCards[0].offsetWidth : trackElement.clientWidth;
    }

    function getCardsPerPage() {
      const cardsThatFit = (trackElement.clientWidth + CARD_FIT_TOLERANCE_PX)
        / getCardStepWidthPx();

      return Math.max(1, Math.round(cardsThatFit));
    }

    function getMaxScrollLeftPx() {
      return Math.max(0, trackElement.scrollWidth - trackElement.clientWidth);
    }

    function getPageCount() {
      return Math.max(1, Math.ceil(getVisibleCards().length / getCardsPerPage()));
    }

    function getCurrentPage() {
      if (trackElement.scrollLeft >= getMaxScrollLeftPx() - SCROLL_END_TOLERANCE_PX) {
        return getPageCount() - 1;
      }

      return Math.min(
        getPageCount() - 1,
        Math.round(trackElement.scrollLeft / (getCardsPerPage() * getCardStepWidthPx()))
      );
    }

    function goToPage(pageIndex) {
      const scrollTarget = Math.min(
        getMaxScrollLeftPx(),
        pageIndex * getCardsPerPage() * getCardStepWidthPx()
      );
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      trackElement.scrollTo({
        left: scrollTarget,
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
    }

    function updateDots() {
      const currentPage = Math.min(getCurrentPage(), dotButtons.length - 1);

      dotButtons.forEach(function (dotButton, dotIndex) {
        dotButton.classList.toggle('is-active', dotIndex === currentPage);
      });
    }

    function onTrackScroll() {
      if (isScrollUpdateQueued) {
        return;
      }

      isScrollUpdateQueued = true;
      window.requestAnimationFrame(function () {
        isScrollUpdateQueued = false;
        updateDots();
      });
    }

    function buildDots() {
      const pageCount = getPageCount();
      const hasMultiplePages = pageCount > 1;

      dotsContainer.replaceChildren();
      dotButtons = [];
      previousButton.hidden = !hasMultiplePages;
      nextButton.hidden = !hasMultiplePages;

      if (!hasMultiplePages) {
        return;
      }

      for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        const dotButton = document.createElement('button');
        const pageNumber = String(pageIndex + 1);

        dotButton.type = 'button';
        dotButton.className = 'jp-bs__dot';
        dotButton.setAttribute(
          'aria-label',
          dotLabelTemplate.replace(PAGE_NUMBER_TOKEN, pageNumber)
        );
        dotButton.addEventListener('click', function () {
          goToPage(pageIndex);
        });
        dotsContainer.appendChild(dotButton);
        dotButtons.push(dotButton);
      }

      updateDots();
    }

    function showTab(tabId) {
      productCards.forEach(function (productCard) {
        productCard.hidden = hasTabs && productCard.dataset.tab !== tabId;
      });
      trackElement.scrollLeft = 0;
      buildDots();
    }

    function handleResize() {
      if (!bestSellersRoot.isConnected) {
        window.removeEventListener('resize', handleResize);
        return;
      }

      clearTimeout(resizeDebounceTimeoutId);
      resizeDebounceTimeoutId = setTimeout(buildDots, RESIZE_DEBOUNCE_MS);
    }

    tabButtons.forEach(function (tabButton) {
      tabButton.addEventListener('click', function () {
        tabButtons.forEach(function (otherTabButton) {
          const isSelectedTab = otherTabButton === tabButton;

          otherTabButton.setAttribute('aria-selected', isSelectedTab ? 'true' : 'false');
        });
        trackElement.setAttribute('aria-labelledby', tabButton.id);
        showTab(tabButton.dataset.jpBsTab);
      });
    });

    previousButton.addEventListener('click', function () {
      goToPage(Math.max(0, getCurrentPage() - 1));
    });

    nextButton.addEventListener('click', function () {
      goToPage(Math.min(getPageCount() - 1, getCurrentPage() + 1));
    });

    trackElement.addEventListener('scroll', onTrackScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    showTab(hasTabs ? tabButtons[0].dataset.jpBsTab : DEFAULT_TAB_ID);
  }

  function initAllBestSellers() {
    document.querySelectorAll('[data-jp-bs]').forEach(initBestSellers);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllBestSellers);
  } else {
    initAllBestSellers();
  }

  document.addEventListener('shopify:section:load', initAllBestSellers);
})();
