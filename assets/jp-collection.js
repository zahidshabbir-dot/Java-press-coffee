(function () {
  /* keep in sync with the 749px breakpoint in jp-collection.css */
  const MOBILE_MAX_WIDTH_PX = 749;
  const mobileMediaQuery = window.matchMedia('(max-width: ' + MOBILE_MAX_WIDTH_PX + 'px)');
  const AUTO_SUBMIT_DELAY_MS = 250;
  const OPEN_DROPDOWN_SELECTOR = 'details.jp-cl__drop[open]';
  const FILTER_PANEL_SELECTOR = '.jp-cl__bar';
  const OVERLAY_SELECTOR = '.jp-cl__overlay';
  const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'summary',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');

  function initCollection(collectionRoot) {
    if (collectionRoot.dataset.jpClReady) {
      return;
    }

    const filterForm = collectionRoot.querySelector('form');

    if (!filterForm) {
      return;
    }

    collectionRoot.dataset.jpClReady = 'true';

    const filterPanel = collectionRoot.querySelector(FILTER_PANEL_SELECTOR);
    const overlay = collectionRoot.querySelector(OVERLAY_SELECTOR);
    let autoSubmitTimeoutId;
    let isFilterPanelOpen = false;
    let previousPageOverflow = '';
    let focusBeforeOpen = null;

    function getPanelFocusableElements() {
      if (!filterPanel) {
        return [];
      }

      return Array.from(filterPanel.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        function (focusableElement) {
          return focusableElement.offsetParent !== null;
        }
      );
    }

    function setFilterPanelOpen(shouldOpen) {
      if (shouldOpen === isFilterPanelOpen) {
        return;
      }

      isFilterPanelOpen = shouldOpen;
      collectionRoot.classList.toggle('is-open', shouldOpen);

      if (overlay) {
        overlay.hidden = !shouldOpen;
      }

      /* only undo the page scroll lock that this panel set itself */
      if (shouldOpen) {
        previousPageOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';
        focusBeforeOpen = document.activeElement;

        const focusableElements = getPanelFocusableElements();

        if (focusableElements.length) {
          focusableElements[0].focus();
        }

        return;
      }

      document.documentElement.style.overflow = previousPageOverflow;

      if (focusBeforeOpen && collectionRoot.contains(focusBeforeOpen)) {
        focusBeforeOpen.focus();
      }

      focusBeforeOpen = null;
    }

    function trapFocus(event) {
      const focusableElements = getPanelFocusableElements();

      if (!focusableElements.length) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    /* document listeners remove themselves when the section is re-rendered (theme editor) */
    function onKeyDown(event) {
      if (!collectionRoot.isConnected) {
        document.removeEventListener('keydown', onKeyDown);
        return;
      }

      if (!isFilterPanelOpen) {
        return;
      }

      if (event.key === 'Escape') {
        setFilterPanelOpen(false);
      } else if (event.key === 'Tab') {
        trapFocus(event);
      }
    }

    function onDocumentClick(event) {
      if (!collectionRoot.isConnected) {
        document.removeEventListener('click', onDocumentClick);
        return;
      }

      if (mobileMediaQuery.matches) {
        return;
      }

      collectionRoot.querySelectorAll(OPEN_DROPDOWN_SELECTOR).forEach(function (dropdown) {
        if (!dropdown.contains(event.target)) {
          dropdown.removeAttribute('open');
        }
      });
    }

    function onMediaChange() {
      if (!collectionRoot.isConnected) {
        mobileMediaQuery.removeEventListener('change', onMediaChange);
        return;
      }

      if (!mobileMediaQuery.matches) {
        setFilterPanelOpen(false);
      }
    }

    /* theme editor: give the page its scroll back if the section goes away while open */
    function onSectionUnload(event) {
      if (!event.target.contains(collectionRoot)) {
        return;
      }

      setFilterPanelOpen(false);
      document.removeEventListener('shopify:section:unload', onSectionUnload);
    }

    collectionRoot.querySelectorAll('[data-jp-cl-open]').forEach(function (openButton) {
      openButton.addEventListener('click', function () {
        setFilterPanelOpen(true);
      });
    });

    collectionRoot.querySelectorAll('[data-jp-cl-close]').forEach(function (closeButton) {
      closeButton.addEventListener('click', function () {
        setFilterPanelOpen(false);
      });
    });

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('shopify:section:unload', onSectionUnload);
    mobileMediaQuery.addEventListener('change', onMediaChange);

    filterForm.addEventListener('change', function (event) {
      if (mobileMediaQuery.matches || !event.target.hasAttribute('data-jp-cl-auto')) {
        return;
      }

      clearTimeout(autoSubmitTimeoutId);
      autoSubmitTimeoutId = setTimeout(function () {
        filterForm.submit();
      }, AUTO_SUBMIT_DELAY_MS);
    });

    document.addEventListener('click', onDocumentClick);
  }

  function initAllCollections(scope) {
    scope.querySelectorAll('[data-jp-cl]').forEach(initCollection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initAllCollections(document);
    });
  } else {
    initAllCollections(document);
  }

  document.addEventListener('shopify:section:load', function (event) {
    initAllCollections(event.target);
  });
})();
