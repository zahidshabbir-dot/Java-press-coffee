/* Delivery date calendar for the cart drawer (Figma "Date-Picker").
   The calendar frame (buttons, labels, week days) is rendered by Liquid in snippets/cart-drawer.liquid.
   This script only updates the title, the day buttons and the selected value.
   It reads and writes the hidden input [data-jp-delivery-date]; jp-ajax-cart.js saves it on the cart. */
(() => {
  if (window.__jpCal) {
    return;
  }
  window.__jpCal = true;

  const padTwoDigits = (number) => (number < 10 ? '0' : '') + number;

  /* month is zero-based, like Date.getMonth() */
  const toIsoString = (year, month, day) => `${year}-${padTwoDigits(month + 1)}-${padTwoDigits(day)}`;

  const parseIsoDate = (isoString) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoString || '');
    if (!match) {
      return null;
    }
    return {
      year: +match[1],
      month: +match[2] - 1,
      day: +match[3]
    };
  };

  const dateToIso = (date) => toIsoString(date.year, date.month, date.day);

  const formatDisplayDate = (date) => `${padTwoDigits(date.day)} / ${padTwoDigits(date.month + 1)} / ${date.year}`;

  const getMonthName = (year, month) => new Date(year, month, 1).toLocaleString(document.documentElement.lang || undefined, { month: 'long' });

  /* A saved date is only valid when it is on or after the minimum date */
  const isValidDate = (dateInput) => {
    const savedDate = parseIsoDate(dateInput.value);
    const minDate = parseIsoDate(dateInput.dataset.min);
    if (!savedDate) {
      return false;
    }
    return !minDate || dateToIso(savedDate) >= dateToIso(minDate);
  };

  /* Remove a saved date that is now in the past, and tell the cart */
  const clearStaleDate = (calendarField) => {
    const dateInput = calendarField.querySelector('[data-jp-delivery-date]');
    if (!dateInput || !dateInput.value || isValidDate(dateInput)) {
      return;
    }
    dateInput.value = '';
    const fieldLabel = calendarField.querySelector('[data-jp-cal-label]');
    if (fieldLabel && fieldLabel.dataset.empty) {
      fieldLabel.textContent = fieldLabel.dataset.empty;
    }
    dateInput.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const renderCalendar = (calendarField, calendarState) => {
    const panel = calendarField.querySelector('.jp-cal');
    const daysContainer = panel.querySelector('[data-jp-cal-days]');
    const titleElement = panel.querySelector('[data-jp-cal-title]');
    const previousButton = panel.querySelector('[data-jp-cal-prev]');
    const valueElement = panel.querySelector('[data-jp-cal-value]');
    const setButton = panel.querySelector('[data-jp-cal-set]');
    if (!daysContainer || !titleElement || !previousButton || !valueElement || !setButton) {
      return;
    }

    const { year, month } = calendarState.view;
    const minIso = dateToIso(calendarState.min);
    // Monday first
    const leadingBlankCount = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    titleElement.textContent = getMonthName(year, month) + (year !== new Date().getFullYear() ? ` ${year}` : '');
    previousButton.disabled = year < calendarState.min.year || (year === calendarState.min.year && month <= calendarState.min.month);

    daysContainer.replaceChildren();
    for (let i = 0; i < leadingBlankCount; i++) {
      daysContainer.appendChild(document.createElement('span'));
    }
    for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber++) {
      const dayIso = toIsoString(year, month, dayNumber);
      const dayButton = document.createElement('button');
      dayButton.type = 'button';
      dayButton.className = 'jp-cal__day';
      dayButton.dataset.jpCalDay = dayIso;
      dayButton.textContent = dayNumber;
      dayButton.disabled = dayIso < minIso;
      if (calendarState.pick && dayIso === dateToIso(calendarState.pick)) {
        dayButton.classList.add('is-selected');
      }
      daysContainer.appendChild(dayButton);
    }

    valueElement.textContent = calendarState.pick ? formatDisplayDate(calendarState.pick) : valueElement.dataset.empty;
    setButton.disabled = !calendarState.pick;
  };

  const closeCalendar = (calendarField) => {
    const panel = calendarField.querySelector('.jp-cal');
    if (panel) {
      panel.hidden = true;
    }
    const openButton = calendarField.querySelector('[data-jp-cal-open]');
    if (openButton) {
      openButton.setAttribute('aria-expanded', 'false');
    }
    calendarField.__jpState = null;
  };

  const openCalendar = (calendarField) => {
    const dateInput = calendarField.querySelector('[data-jp-delivery-date]');
    const panel = calendarField.querySelector('.jp-cal');
    if (!dateInput || !panel) {
      return;
    }
    clearStaleDate(calendarField);
    const today = new Date();
    const minDate = parseIsoDate(dateInput.dataset.min) || {
      year: today.getFullYear(),
      month: today.getMonth(),
      day: today.getDate()
    };
    const currentDate = parseIsoDate(dateInput.value);
    const calendarState = {
      min: minDate,
      pick: currentDate && dateToIso(currentDate) >= dateToIso(minDate) ? currentDate : null,
      view: {
        year: (currentDate || minDate).year,
        month: (currentDate || minDate).month
      }
    };
    calendarField.__jpState = calendarState;
    renderCalendar(calendarField, calendarState);
    panel.hidden = false;
    const openButton = calendarField.querySelector('[data-jp-cal-open]');
    if (openButton) {
      openButton.setAttribute('aria-expanded', 'true');
    }
  };

  /* Blocks checkout when a date is required and none (or only a past one) is set */
  const requireDateBeforeCheckout = (event) => {
    const dateInput = document.querySelector('[data-jp-delivery-date]');
    const calendarField = dateInput ? dateInput.closest('[data-jp-cal]') : null;
    if (calendarField) {
      // a date that is already in the past counts as no date
      clearStaleDate(calendarField);
    }
    if (dateInput && dateInput.dataset.required === 'true' && !dateInput.value) {
      event.preventDefault();
      if (calendarField) {
        calendarField.classList.add('has-error');
        openCalendar(calendarField);
      }
    }
  };

  document.addEventListener('click', (event) => {
    const clickTarget = event.target;
    if (!clickTarget.closest) {
      return;
    }
    const calendarField = clickTarget.closest('[data-jp-cal]');

    // close any calendar when clicking elsewhere
    document.querySelectorAll('[data-jp-cal]').forEach((otherField) => {
      if (otherField !== calendarField && otherField.__jpState) {
        closeCalendar(otherField);
      }
    });

    if (!calendarField) {
      // checkout needs a date?
      if (clickTarget.closest('#CartDrawer-Checkout')) {
        requireDateBeforeCheckout(event);
      }
      return;
    }

    const calendarState = calendarField.__jpState;
    if (clickTarget.closest('[data-jp-cal-open]')) {
      event.preventDefault();
      if (calendarState) {
        closeCalendar(calendarField);
      } else {
        openCalendar(calendarField);
      }
      return;
    }
    if (!calendarState) {
      return;
    }

    const dayButton = clickTarget.closest('[data-jp-cal-day]');
    if (dayButton && !dayButton.disabled) {
      calendarState.pick = parseIsoDate(dayButton.dataset.jpCalDay);
      renderCalendar(calendarField, calendarState);
      return;
    }
    if (clickTarget.closest('[data-jp-cal-prev]')) {
      calendarState.view.month--;
      if (calendarState.view.month < 0) {
        calendarState.view.month = 11;
        calendarState.view.year--;
      }
      renderCalendar(calendarField, calendarState);
      return;
    }
    if (clickTarget.closest('[data-jp-cal-next]')) {
      calendarState.view.month++;
      if (calendarState.view.month > 11) {
        calendarState.view.month = 0;
        calendarState.view.year++;
      }
      renderCalendar(calendarField, calendarState);
      return;
    }
    if (clickTarget.closest('[data-jp-cal-set]') && calendarState.pick) {
      const dateInput = calendarField.querySelector('[data-jp-delivery-date]');
      const fieldLabel = calendarField.querySelector('[data-jp-cal-label]');
      const pickedDate = calendarState.pick;
      dateInput.value = dateToIso(pickedDate);
      if (fieldLabel) {
        fieldLabel.textContent = `${padTwoDigits(pickedDate.day)}/${padTwoDigits(pickedDate.month + 1)}/${pickedDate.year}`;
      }
      calendarField.classList.remove('has-error');
      dateInput.dispatchEvent(new Event('change', { bubbles: true }));
      closeCalendar(calendarField);
    }
  });

  /* Escape closes only the calendar, not the whole cart drawer.
     The drawer listens for Escape on keyup, so that event is stopped too. */
  let escapeUsed = false;
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }
    document.querySelectorAll('[data-jp-cal]').forEach((calendarField) => {
      if (calendarField.__jpState) {
        closeCalendar(calendarField);
        event.stopPropagation();
        escapeUsed = true;
      }
    });
  }, true);
  document.addEventListener('keyup', (event) => {
    if (event.key !== 'Escape' || !escapeUsed) {
      return;
    }
    escapeUsed = false;
    event.stopPropagation();
  }, true);

  /* Pressing Enter in the cart note submits the cart form to checkout without a click: check the date there too */
  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!form || form.id !== 'CartDrawer-Form') {
      return;
    }
    if (event.submitter && event.submitter.name !== 'checkout') {
      return;
    }
    requireDateBeforeCheckout(event);
  });
})();
