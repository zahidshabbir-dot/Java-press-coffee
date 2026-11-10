(function () {
  const mobileQuery = window.matchMedia('(max-width: 749px)');

  function initCollection(collectionRoot) {
    if (collectionRoot.dataset.jpClReady) {
      return;
    }

    const filterForm = collectionRoot.querySelector('form');

    if (!filterForm) {
      return;
    }

    collectionRoot.dataset.jpClReady = 'true';

    let submitTimer;
    let isOpen = false;
    let savedOverflow = '';

    function setOpen(open) {
      if (open === isOpen) {
        return;
      }

      isOpen = open;
      collectionRoot.classList.toggle('is-open', open);

      const overlay = collectionRoot.querySelector('.jp-cl__overlay');

      if (overlay) {
        overlay.hidden = !open;
      }

      /* only undo the page scroll lock that this panel set itself */
      if (open) {
        savedOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';
      } else {
        document.documentElement.style.overflow = savedOverflow;
      }
    }

    /* document listeners remove themselves when the section is re-rendered (theme editor) */
    function onKeydown(event) {
      if (!collectionRoot.isConnected) {
        document.removeEventListener('keydown', onKeydown);
        return;
      }

      if (event.key === 'Escape' && isOpen) {
        setOpen(false);
      }
    }

    function onDocumentClick(event) {
      if (!collectionRoot.isConnected) {
        document.removeEventListener('click', onDocumentClick);
        return;
      }

      if (mobileQuery.matches) {
        return;
      }

      collectionRoot.querySelectorAll('details.jp-cl__drop[open]').forEach(function (dropdown) {
        if (!dropdown.contains(event.target)) {
          dropdown.removeAttribute('open');
        }
      });
    }

    function onMediaChange() {
      if (!collectionRoot.isConnected) {
        mobileQuery.removeEventListener('change', onMediaChange);
        return;
      }

      if (!mobileQuery.matches) {
        setOpen(false);
      }
    }

    collectionRoot.querySelectorAll('[data-jp-cl-open]').forEach(function (openButton) {
      openButton.addEventListener('click', function () {
        setOpen(true);
      });
    });

    collectionRoot.querySelectorAll('[data-jp-cl-close]').forEach(function (closeButton) {
      closeButton.addEventListener('click', function () {
        setOpen(false);
      });
    });

    document.addEventListener('keydown', onKeydown);
    mobileQuery.addEventListener('change', onMediaChange);

    filterForm.addEventListener('change', function (event) {
      if (mobileQuery.matches || !event.target.hasAttribute('data-jp-cl-auto')) {
        return;
      }

      clearTimeout(submitTimer);
      submitTimer = setTimeout(function () {
        filterForm.submit();
      }, 250);
    });

    document.addEventListener('click', onDocumentClick);
  }

  function initAll(scope) {
    scope.querySelectorAll('[data-jp-cl]').forEach(initCollection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initAll(document);
    });
  } else {
    initAll(document);
  }

  document.addEventListener('shopify:section:load', function (event) {
    initAll(event.target);
  });
})();
