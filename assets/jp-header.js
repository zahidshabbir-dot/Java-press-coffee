(function () {
  const MOBILE_QUERY = '(max-width: 989px)';

  function initHeader(headerRoot) {
    if (headerRoot.dataset.jpHdReady === 'true') return;

    const burgerButton = headerRoot.querySelector('[data-jp-hd-burger]');
    const navigation = headerRoot.querySelector('.jp-hd__nav');
    const closeButton = headerRoot.querySelector('[data-jp-hd-close]');
    if (!burgerButton || !navigation || !closeButton) return;
    headerRoot.dataset.jpHdReady = 'true';

    const mobileQuery = window.matchMedia(MOBILE_QUERY);
    let savedOverflow = '';

    function setMenuOpen(shouldOpen) {
      const wasOpen = headerRoot.classList.contains('is-open');
      headerRoot.classList.toggle('is-open', shouldOpen);
      burgerButton.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');

      /* only undo the page scroll lock that this menu set itself */
      if (shouldOpen && !wasOpen) {
        savedOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';
      } else if (!shouldOpen && wasOpen) {
        document.documentElement.style.overflow = savedOverflow;
      }

      if (shouldOpen && !wasOpen && mobileQuery.matches) {
        closeButton.focus();
      }

      if (!shouldOpen) {
        navigation.classList.remove('has-active');
        const activeItem = navigation.querySelector('.jp-hd__item.is-active');
        if (activeItem) {
          activeItem.classList.remove('is-active');
        }
      }
    }

    burgerButton.addEventListener('click', function () {
      setMenuOpen(!headerRoot.classList.contains('is-open'));
    });

    closeButton.addEventListener('click', function () {
      setMenuOpen(false);
      burgerButton.focus();
    });

    navigation.addEventListener('click', function (event) {
      if (!mobileQuery.matches) return;

      const parentLink = event.target.closest('.jp-hd__item.has-sub > .jp-hd__link');
      if (parentLink) {
        event.preventDefault();
        const menuItem = parentLink.parentNode;
        const isActive = menuItem.classList.toggle('is-active');
        navigation.classList.toggle('has-active', isActive);
        navigation.scrollTop = 0;
        return;
      }

      const grandparentLink = event.target.closest('.jp-hd__sub-list li.has-grand > a');
      if (grandparentLink) {
        event.preventDefault();
        grandparentLink.parentNode.classList.toggle('is-open');
      }
    });

    /* document listeners remove themselves when the section is re-rendered (theme editor) */
    function onMediaChange() {
      if (!headerRoot.isConnected) {
        mobileQuery.removeEventListener('change', onMediaChange);
        return;
      }
      if (!mobileQuery.matches) {
        setMenuOpen(false);
      }
    }

    function onKeyDown(event) {
      if (!headerRoot.isConnected) {
        document.removeEventListener('keydown', onKeyDown);
        return;
      }

      if (event.key === 'Escape' && headerRoot.classList.contains('is-open')) {
        setMenuOpen(false);
        burgerButton.focus();
      }

      /* keep Tab inside the open mobile menu */
      if (event.key === 'Tab' && mobileQuery.matches && headerRoot.classList.contains('is-open')) {
        const focusableElements = navigation.querySelectorAll('a[href], button:not([disabled])');
        if (!focusableElements.length) return;

        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === firstFocusable) {
          event.preventDefault();
          lastFocusable.focus();
        } else if (!event.shiftKey && document.activeElement === lastFocusable) {
          event.preventDefault();
          firstFocusable.focus();
        }
      }
    }

    mobileQuery.addEventListener('change', onMediaChange);
    document.addEventListener('keydown', onKeyDown);
  }

  function initAllHeaders() {
    document.querySelectorAll('[data-jp-hd]').forEach(initHeader);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllHeaders);
  } else {
    initAllHeaders();
  }
  document.addEventListener('shopify:section:load', initAllHeaders);
})();
