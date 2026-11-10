(function () {
  const RESIZE_DEBOUNCE_MS = 150;

  function initBestSellers(bestSellersRoot) {
    if (bestSellersRoot.dataset.jpBsReady === 'true') return;

    const trackElement = bestSellersRoot.querySelector('[data-jp-bs-track]');
    const dotsContainer = bestSellersRoot.querySelector('[data-jp-bs-dots]');
    const previousButton = bestSellersRoot.querySelector('[data-jp-bs-prev]');
    const nextButton = bestSellersRoot.querySelector('[data-jp-bs-next]');
    if (!trackElement || !dotsContainer || !previousButton || !nextButton) return;

    bestSellersRoot.dataset.jpBsReady = 'true';

    const productCards = Array.prototype.slice.call(
      bestSellersRoot.querySelectorAll('[data-jp-bs-card]')
    );
    const tabButtons = Array.prototype.slice.call(
      bestSellersRoot.querySelectorAll('[data-jp-bs-tab]')
    );
    let dotButtons = [];
    let resizeTimer = null;

    function getVisibleCards() {
      return productCards.filter(function (productCard) {
        return !productCard.hidden;
      });
    }

    function getCardStep() {
      const visibleCards = getVisibleCards();
      if (visibleCards.length > 1) {
        return Math.abs(visibleCards[1].offsetLeft - visibleCards[0].offsetLeft) || visibleCards[0].offsetWidth;
      }
      return visibleCards.length ? visibleCards[0].offsetWidth : trackElement.clientWidth;
    }

    function getCardsPerPage() {
      return Math.max(1, Math.round((trackElement.clientWidth + 1) / getCardStep()));
    }

    function getMaxScroll() {
      return Math.max(0, trackElement.scrollWidth - trackElement.clientWidth);
    }

    function getPageCount() {
      return Math.max(1, Math.ceil(getVisibleCards().length / getCardsPerPage()));
    }

    function getCurrentPage() {
      if (trackElement.scrollLeft >= getMaxScroll() - 2) return getPageCount() - 1;
      return Math.min(
        getPageCount() - 1,
        Math.round(trackElement.scrollLeft / (getCardsPerPage() * getCardStep()))
      );
    }

    function goToPage(pageIndex) {
      const scrollTarget = Math.min(getMaxScroll(), pageIndex * getCardsPerPage() * getCardStep());
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

    function buildDots() {
      const pageCount = getPageCount();
      const hasMultiplePages = pageCount > 1;

      dotsContainer.replaceChildren();
      dotButtons = [];
      previousButton.hidden = !hasMultiplePages;
      nextButton.hidden = !hasMultiplePages;
      if (!hasMultiplePages) return;

      for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        const dotButton = document.createElement('button');
        dotButton.type = 'button';
        dotButton.className = 'jp-bs__dot';
        dotButton.setAttribute('aria-label', 'Go to page ' + (pageIndex + 1));
        dotButton.addEventListener('click', function () {
          goToPage(pageIndex);
        });
        dotsContainer.appendChild(dotButton);
        dotButtons.push(dotButton);
      }
      updateDots();
    }

    function showTab(tabNumber) {
      productCards.forEach(function (productCard) {
        productCard.hidden = !!tabButtons.length && productCard.dataset.tab !== tabNumber;
      });
      trackElement.scrollLeft = 0;
      buildDots();
    }

    function handleResize() {
      if (!bestSellersRoot.isConnected) {
        window.removeEventListener('resize', handleResize);
        return;
      }
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(buildDots, RESIZE_DEBOUNCE_MS);
    }

    tabButtons.forEach(function (tabButton) {
      tabButton.addEventListener('click', function () {
        tabButtons.forEach(function (otherTabButton) {
          otherTabButton.setAttribute('aria-selected', otherTabButton === tabButton ? 'true' : 'false');
        });
        showTab(tabButton.dataset.jpBsTab);
      });
    });

    previousButton.addEventListener('click', function () {
      goToPage(Math.max(0, getCurrentPage() - 1));
    });

    nextButton.addEventListener('click', function () {
      goToPage(Math.min(getPageCount() - 1, getCurrentPage() + 1));
    });

    trackElement.addEventListener('scroll', updateDots, { passive: true });
    window.addEventListener('resize', handleResize);

    showTab(tabButtons.length ? tabButtons[0].dataset.jpBsTab : '1');
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
