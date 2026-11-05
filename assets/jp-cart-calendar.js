/* Delivery date calendar for the cart drawer (Figma "Date-Picker").
   Reads/writes the hidden input [data-jp-delivery-date]; the existing change handler saves it on the cart. */
(function () {
  if (window.__jpCal) return;
  window.__jpCal = true;

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  var ARROW = '<svg viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M11 3.5L5.500 9L11 14.500" stroke="#09090b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
  function parse(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
    return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
  }
  function show(d) { return pad(d.d) + ' / ' + pad(d.m + 1) + ' / ' + d.y; }

  function render(wrap, state) {
    var panel = wrap.querySelector('.jp-cal');
    var minD = state.min;
    var y = state.view.y, m = state.view.m;
    var first = new Date(y, m, 1);
    var lead = (first.getDay() + 6) % 7; // Monday first
    var days = new Date(y, m + 1, 0).getDate();
    var prevDisabled = y < minD.y || (y === minD.y && m <= minD.m);
    var title = MONTHS[m] + (y !== new Date().getFullYear() ? ' ' + y : '');

    var html = '<div class="jp-cal__head">' +
      '<button type="button" class="jp-cal__nav" data-jp-cal-prev aria-label="Previous month"' + (prevDisabled ? ' disabled' : '') + '>' + ARROW + '</button>' +
      '<p class="jp-cal__title" aria-live="polite">' + title + '</p>' +
      '<button type="button" class="jp-cal__nav jp-cal__nav--next" data-jp-cal-next aria-label="Next month">' + ARROW + '</button>' +
      '</div><div class="jp-cal__week">' + WEEK.map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div><div class="jp-cal__days">';
    for (var i = 0; i < lead; i++) html += '<span></span>';
    for (var d = 1; d <= days; d++) {
      var v = iso(y, m, d);
      var disabled = v < iso(minD.y, minD.m, minD.d);
      var selected = state.pick && v === iso(state.pick.y, state.pick.m, state.pick.d);
      html += '<button type="button" class="jp-cal__day' + (selected ? ' is-selected' : '') + '" data-jp-cal-day="' + v + '"' + (disabled ? ' disabled' : '') + '>' + d + '</button>';
    }
    html += '</div><div class="jp-cal__foot"><span class="jp-cal__value">' + (state.pick ? show(state.pick) : 'dd / mm / yyyy') + '</span>' +
      '<button type="button" class="jp-cal__set" data-jp-cal-set' + (state.pick ? '' : ' disabled') + '>Set Date</button></div>';
    panel.innerHTML = html;
  }

  function close(wrap) {
    var panel = wrap.querySelector('.jp-cal');
    if (panel) panel.hidden = true;
    var btn = wrap.querySelector('[data-jp-cal-open]');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    wrap.__jpState = null;
  }

  function open(wrap) {
    var input = wrap.querySelector('[data-jp-delivery-date]');
    var minD = parse(input.dataset.min) || (function () { var t = new Date(); return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() }; })();
    var cur = parse(input.value);
    var state = { min: minD, pick: cur && iso(cur.y, cur.m, cur.d) >= iso(minD.y, minD.m, minD.d) ? cur : null, view: { y: (cur || minD).y, m: (cur || minD).m } };
    wrap.__jpState = state;
    render(wrap, state);
    wrap.querySelector('.jp-cal').hidden = false;
    wrap.querySelector('[data-jp-cal-open]').setAttribute('aria-expanded', 'true');
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest) return;
    var wrap = t.closest('[data-jp-cal]');

    // close any calendar when clicking elsewhere
    document.querySelectorAll('[data-jp-cal]').forEach(function (w) { if (w !== wrap && w.__jpState) close(w); });
    if (!wrap) {
      // checkout needs a date?
      var checkout = t.closest('#CartDrawer-Checkout');
      if (checkout) {
        var inp = document.querySelector('[data-jp-delivery-date]');
        if (inp && inp.dataset.required === 'true' && !inp.value) {
          e.preventDefault();
          var w2 = inp.closest('[data-jp-cal]');
          w2.classList.add('has-error');
          open(w2);
        }
      }
      return;
    }

    var state = wrap.__jpState;
    if (t.closest('[data-jp-cal-open]')) {
      e.preventDefault();
      if (state) close(wrap); else open(wrap);
      return;
    }
    if (!state) return;
    var day = t.closest('[data-jp-cal-day]');
    if (day && !day.disabled) { state.pick = parse(day.dataset.jpCalDay); render(wrap, state); return; }
    if (t.closest('[data-jp-cal-prev]')) { state.view.m--; if (state.view.m < 0) { state.view.m = 11; state.view.y--; } render(wrap, state); return; }
    if (t.closest('[data-jp-cal-next]')) { state.view.m++; if (state.view.m > 11) { state.view.m = 0; state.view.y++; } render(wrap, state); return; }
    if (t.closest('[data-jp-cal-set]') && state.pick) {
      var input = wrap.querySelector('[data-jp-delivery-date]');
      input.value = iso(state.pick.y, state.pick.m, state.pick.d);
      wrap.querySelector('[data-jp-cal-label]').textContent = pad(state.pick.d) + '/' + pad(state.pick.m + 1) + '/' + state.pick.y;
      wrap.classList.remove('has-error');
      input.dispatchEvent(new Event('change', { bubbles: true }));
      close(wrap);
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('[data-jp-cal]').forEach(function (w) {
      if (w.__jpState) { close(w); e.stopPropagation(); }
    });
  }, true);
})();
