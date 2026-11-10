/*
  Shared helpers for the Java Press sections. Loaded once in layout/theme.liquid,
  before the section scripts (all scripts use defer, so they run in page order).

  window.JpSections.onSectionReady(selector, initElement)
    Calls initElement(element) for every element matching selector when the page
    is ready, and again for new elements when a section is re-rendered in the
    theme editor (shopify:section:load). Each section script guards against
    starting the same element twice.

  window.JpSections.lockPageScroll()
    Stops the page from scrolling and returns a function that restores the
    previous scroll setting.

  window.JpSections.getFocusableElements(container)
    Returns the visible elements inside container that can take keyboard focus.

  window.JpSections.keepFocusInside(event, container)
    For a Tab keydown event: moves focus from the last element back to the first
    (and the other way round with Shift), so focus stays inside container.
*/
(function () {
  if (window.JpSections) {
    return;
  }

  const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'summary',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  function initMatchingElements(scope, selector, initElement) {
    if (scope.matches && scope.matches(selector)) {
      initElement(scope);
    }

    scope.querySelectorAll(selector).forEach(initElement);
  }

  function onSectionReady(selector, initElement) {
    function initInDocument() {
      initMatchingElements(document, selector, initElement);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initInDocument);
    } else {
      initInDocument();
    }

    document.addEventListener('shopify:section:load', function (event) {
      initMatchingElements(event.target, selector, initElement);
    });
  }

  function lockPageScroll() {
    const pageElement = document.documentElement;
    const previousOverflow = pageElement.style.overflow;

    pageElement.style.overflow = 'hidden';

    return function unlockPageScroll() {
      pageElement.style.overflow = previousOverflow;
    };
  }

  function getFocusableElements(container) {
    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
      function (focusableElement) {
        return focusableElement.offsetParent !== null;
      }
    );
  }

  function keepFocusInside(event, container) {
    if (event.key !== 'Tab') {
      return;
    }

    const focusableElements = getFocusableElements(container);

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

  window.JpSections = {
    onSectionReady: onSectionReady,
    lockPageScroll: lockPageScroll,
    getFocusableElements: getFocusableElements,
    keepFocusInside: keepFocusInside,
  };
})();
