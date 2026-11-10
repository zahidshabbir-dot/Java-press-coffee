(function () {
  const MOBILE_MEDIA_QUERY = '(max-width: 989px)';
  const HEADER_SELECTOR = '[data-jp-hd]';
  const MENU_TOGGLE_SELECTOR = '[data-jp-hd-burger]';
  const CLOSE_BUTTON_SELECTOR = '[data-jp-hd-close]';
  const NAVIGATION_PANEL_SELECTOR = '.jp-hd__nav';
  const ACTIVE_ITEM_SELECTOR = '.jp-hd__item.is-active';
  const DROPDOWN_PARENT_LINK_SELECTOR = '.jp-hd__item.has-sub > .jp-hd__link';
  const GRANDCHILD_PARENT_LINK_SELECTOR = '.jp-hd__sub-list li.has-grand > a';
  const OPEN_CLASS = 'is-open';
  const ACTIVE_CLASS = 'is-active';
  const HAS_ACTIVE_CLASS = 'has-active';

  function initHeader(headerRoot) {
    if (headerRoot.dataset.jpHdReady === 'true') {
      return;
    }

    const menuToggleButton = headerRoot.querySelector(MENU_TOGGLE_SELECTOR);
    const navigationPanel = headerRoot.querySelector(NAVIGATION_PANEL_SELECTOR);
    const closeButton = headerRoot.querySelector(CLOSE_BUTTON_SELECTOR);
    if (!menuToggleButton || !navigationPanel || !closeButton) {
      return;
    }
    headerRoot.dataset.jpHdReady = 'true';

    const mobileMediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    let unlockPageScroll = null;

    function isMenuOpen() {
      return headerRoot.classList.contains(OPEN_CLASS);
    }

    function setMenuOpen(shouldOpen) {
      const wasOpen = isMenuOpen();
      headerRoot.classList.toggle(OPEN_CLASS, shouldOpen);
      menuToggleButton.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');

      /* only undo the page scroll lock that this menu set itself */
      if (shouldOpen && !wasOpen) {
        unlockPageScroll = window.JpSections.lockPageScroll();
      } else if (!shouldOpen && wasOpen && unlockPageScroll) {
        unlockPageScroll();
        unlockPageScroll = null;
      }

      if (shouldOpen && !wasOpen && mobileMediaQuery.matches) {
        closeButton.focus();
      }

      if (!shouldOpen) {
        navigationPanel.classList.remove(HAS_ACTIVE_CLASS);
        const activeItem = navigationPanel.querySelector(ACTIVE_ITEM_SELECTOR);
        if (activeItem) {
          activeItem.classList.remove(ACTIVE_CLASS);
        }
      }
    }

    menuToggleButton.addEventListener('click', function () {
      setMenuOpen(!isMenuOpen());
    });

    closeButton.addEventListener('click', function () {
      setMenuOpen(false);
      menuToggleButton.focus();
    });

    navigationPanel.addEventListener('click', function (event) {
      if (!mobileMediaQuery.matches) {
        return;
      }

      const dropdownParentLink = event.target.closest(DROPDOWN_PARENT_LINK_SELECTOR);
      if (dropdownParentLink) {
        event.preventDefault();
        const menuItem = dropdownParentLink.parentNode;
        const isActive = menuItem.classList.toggle(ACTIVE_CLASS);
        navigationPanel.classList.toggle(HAS_ACTIVE_CLASS, isActive);
        navigationPanel.scrollTop = 0;
        return;
      }

      const grandchildParentLink = event.target.closest(GRANDCHILD_PARENT_LINK_SELECTOR);
      if (grandchildParentLink) {
        event.preventDefault();
        grandchildParentLink.parentNode.classList.toggle(OPEN_CLASS);
      }
    });

    function closeMenuOnEscape(event) {
      if (event.key !== 'Escape' || !isMenuOpen()) {
        return;
      }
      setMenuOpen(false);
      menuToggleButton.focus();
    }

    /* keep Tab inside the open mobile menu */
    function trapFocusInMenu(event) {
      if (event.key !== 'Tab' || !mobileMediaQuery.matches || !isMenuOpen()) {
        return;
      }

      window.JpSections.keepFocusInside(event, navigationPanel);
    }

    /* document listeners remove themselves when the section is re-rendered (theme editor) */
    function onMediaChange() {
      if (!headerRoot.isConnected) {
        mobileMediaQuery.removeEventListener('change', onMediaChange);
        return;
      }
      if (!mobileMediaQuery.matches) {
        setMenuOpen(false);
      }
    }

    function onKeyDown(event) {
      if (!headerRoot.isConnected) {
        document.removeEventListener('keydown', onKeyDown);
        return;
      }
      closeMenuOnEscape(event);
      trapFocusInMenu(event);
    }

    mobileMediaQuery.addEventListener('change', onMediaChange);
    document.addEventListener('keydown', onKeyDown);
  }

  window.JpSections.onSectionReady(HEADER_SELECTOR, initHeader);
})();
