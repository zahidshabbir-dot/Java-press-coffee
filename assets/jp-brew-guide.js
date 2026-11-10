/*
  JP Brew guide (sections/jp-brew-guide.liquid)
  An interactive "make your coffee" pop-up. It opens when a visitor clicks any element with
  the attribute data-jp-brew-open. Every <dialog data-jp-brew> on the page is set up once,
  on page load and again when the theme editor re-renders the section.
  Texts and colors come from the <script type="application/json" data-cfg> block in the dialog.
*/
(function () {
  const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
  const CUP_BOTTOM_Y = 216;
  const STREAM_TOP_Y = 52;
  const CANCELLED = new Error('cancelled');

  /* ---------- color and math helpers ---------- */

  function hexToRgb(colorHex) {
    let hexDigits = String(colorHex).replace('#', '');

    if (hexDigits.length === 3) {
      hexDigits = hexDigits
        .split('')
        .map(function (digit) {
          return digit + digit;
        })
        .join('');
    }

    return [
      parseInt(hexDigits.substr(0, 2), 16),
      parseInt(hexDigits.substr(2, 2), 16),
      parseInt(hexDigits.substr(4, 2), 16)
    ];
  }

  function rgbToHex(rgbChannels) {
    const hexPairs = rgbChannels.map(function (channel) {
      const roundedChannel = Math.max(0, Math.min(255, Math.round(channel)));
      return (roundedChannel < 16 ? '0' : '') + roundedChannel.toString(16);
    });

    return '#' + hexPairs.join('');
  }

  /* Mixes colorA into colorB. amount 0 = colorA, 1 = colorB. */
  function mixColors(colorA, colorB, amount) {
    const rgbA = hexToRgb(colorA);
    const rgbB = hexToRgb(colorB);

    return rgbToHex([
      rgbA[0] + (rgbB[0] - rgbA[0]) * amount,
      rgbA[1] + (rgbB[1] - rgbA[1]) * amount,
      rgbA[2] + (rgbB[2] - rgbA[2]) * amount
    ]);
  }

  /* Positive amount lightens towards white, negative darkens towards black. */
  function shadeColor(colorHex, amount) {
    if (amount >= 0) {
      return mixColors(colorHex, '#ffffff', amount);
    }

    return mixColors(colorHex, '#000000', -amount);
  }

  /* Half of the inside width of the cup at a given height (the cup narrows towards the bottom). */
  function cupHalfWidthAt(positionY) {
    if (positionY <= 150) {
      return 70;
    }

    const depthRatio = (positionY - 150) / 66;
    return 70 - depthRatio * depthRatio * 42;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function easeOut(progress) {
    return 1 - Math.pow(1 - progress, 3);
  }

  function easeInOut(progress) {
    if (progress < 0.5) {
      return 2 * progress * progress;
    }

    return 1 - Math.pow(-2 * progress + 2, 2) / 2;
  }

  function easeIn(progress) {
    return progress * progress;
  }

  function createSvgElement(tagName, attributes) {
    const svgElement = document.createElementNS(SVG_NAMESPACE, tagName);

    for (const attributeName in attributes) {
      svgElement.setAttribute(attributeName, attributes[attributeName]);
    }

    return svgElement;
  }

  /* ---------- one brew guide ---------- */

  function initBrewGuide(brewDialog) {
    if (brewDialog.dataset.jpBgReady) {
      return;
    }

    brewDialog.dataset.jpBgReady = 'true';

    function queryInDialog(selector) {
      return brewDialog.querySelector(selector);
    }

    const config = JSON.parse(queryInDialog('[data-cfg]').textContent);
    const labels = config.labels;

    const steps = Array.prototype.map.call(brewDialog.querySelectorAll('[data-step]'), function (stepItem) {
      return {
        action: stepItem.getAttribute('data-action'),
        title: stepItem.getAttribute('data-title'),
        text: stepItem.getAttribute('data-text')
      };
    });

    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const motionScale = prefersReducedMotion ? 0.01 : 1;

    const elements = {
      stage: queryInDialog('[data-stage]'),
      cupWrap: queryInDialog('[data-cupwrap]'),
      layerGroup: queryInDialog('[data-layers]'),
      surface: queryInDialog('[data-surface]'),
      swirl: queryInDialog('[data-swirl]'),
      stream: queryInDialog('[data-stream]'),
      effectsGroup: queryInDialog('[data-fx]'),
      spoon: queryInDialog('[data-spoon]'),
      spoonLine: queryInDialog('[data-spoon-line]'),
      spoonBowl: queryInDialog('[data-spoon-bowl]'),
      pourer: queryInDialog('[data-pourer]'),
      cupBody: queryInDialog('[data-body]'),
      cupHandle: queryInDialog('[data-handle]'),
      cupRim: queryInDialog('[data-rim]'),
      dots: queryInDialog('[data-dots]'),
      stepLabel: queryInDialog('[data-step-label]'),
      stepTitle: queryInDialog('[data-step-title]'),
      stepText: queryInDialog('[data-step-text]'),
      controls: queryInDialog('[data-controls]')
    };

    /* Every reset starts a new session. Animations from an older session stop on their own,
       so closing and reopening the pop-up during a pour cannot change the new game. */
    let sessionId = 0;

    function animate(durationMs, onFrame, easing) {
      const scaledDurationMs = durationMs * motionScale;

      return new Promise(function (resolve, reject) {
        const startTime = performance.now();
        const ownSessionId = sessionId;

        (function renderFrame(timestamp) {
          if (ownSessionId !== sessionId) {
            reject(CANCELLED);
            return;
          }

          const progress = Math.min(1, (timestamp - startTime) / scaledDurationMs);
          onFrame(easing ? easing(progress) : progress);

          if (progress < 1) {
            requestAnimationFrame(renderFrame);
          } else {
            resolve();
          }
        })(startTime);
      });
    }

    /* ---------- game state ---------- */

    let state;
    let isBusy = false;
    const streamState = { isPouring: false };

    function resetGame() {
      sessionId++;
      isBusy = false;
      streamState.isPouring = false;

      const defaultCupIndex = Math.max(0, Math.min(2, (parseInt(config.defaultCup, 10) || 1) - 1));
      state = {
        stepIndex: 0,
        cupIndex: defaultCupIndex,
        layers: [],
        base: null,
        sugarCount: 0,
        done: false
      };

      elements.layerGroup.replaceChildren();
      elements.effectsGroup.replaceChildren();
      elements.swirl.setAttribute('opacity', '0');
      elements.spoon.setAttribute('opacity', '0');
      elements.stream.setAttribute('opacity', '0');
      elements.pourer.setAttribute('opacity', '0');
      elements.stage.classList.remove('is-done');

      selectCup(state.cupIndex);
      drawDrink();
      showStep();
    }

    function selectCup(cupIndex) {
      state.cupIndex = cupIndex;

      const cupColor = config.cups[cupIndex].color;
      elements.cupBody.setAttribute('fill', cupColor);
      elements.cupHandle.setAttribute('stroke', cupColor);
      elements.cupRim.setAttribute('fill', shadeColor(cupColor, 0.12));
    }

    function getSurfaceY() {
      let surfaceY = CUP_BOTTOM_Y;

      state.layers.forEach(function (layer) {
        surfaceY -= layer.height;
      });

      return surfaceY;
    }

    function drawDrink() {
      let currentY = CUP_BOTTOM_Y;

      state.layers.forEach(function (layer, layerIndex) {
        if (!layer.node) {
          layer.node = createSvgElement('rect', { x: 30, width: 200 });
          elements.layerGroup.appendChild(layer.node);
        }

        const layerTopY = currentY - layer.height;
        layer.node.setAttribute('y', layerTopY);
        layer.node.setAttribute('height', Math.max(0, layer.height + (layerIndex === 0 ? 30 : 0.6)));
        layer.node.setAttribute('fill', layer.color);
        currentY = layerTopY;
      });

      const topLayer = state.layers.length ? state.layers[state.layers.length - 1] : null;

      if (topLayer && currentY < CUP_BOTTOM_Y - 0.5) {
        const surfaceRadiusX = cupHalfWidthAt(currentY) - 2;
        elements.surface.setAttribute('cx', 130);
        elements.surface.setAttribute('cy', currentY);
        elements.surface.setAttribute('rx', surfaceRadiusX);
        elements.surface.setAttribute('ry', surfaceRadiusX * 0.16);
        elements.surface.setAttribute('fill', shadeColor(topLayer.color, state.done ? 0.06 : 0.14));
        elements.surface.setAttribute('opacity', '1');
      } else {
        elements.surface.setAttribute('opacity', '0');
      }

      if (streamState.isPouring) {
        elements.stream.setAttribute('height', Math.max(0, currentY - STREAM_TOP_Y));
      }
    }

    /* ---------- pourers (kettle, milk jug, coffee scoop, sugar) ---------- */

    function showPourer(pourerType) {
      Array.prototype.forEach.call(elements.pourer.querySelectorAll('[data-pr]'), function (pourerGroup) {
        pourerGroup.style.display = pourerGroup.getAttribute('data-pr') === pourerType ? '' : 'none';
      });

      elements.pourer.setAttribute('opacity', '1');
    }

    /* position: 0 = away (top right), 1 = in place above the cup. tilt: 0 = upright, 1 = pouring. */
    function placePourer(position, tilt) {
      const pourerX = 262 - 100 * position;
      const pourerY = -20 + 64 * position;

      elements.pourer.setAttribute('transform', 'translate(' + pourerX + ',' + pourerY + ') rotate(' + (-20 * tilt) + ')');
      elements.pourer.setAttribute('opacity', String(clamp(position * 1.6, 0, 1)));
    }

    function movePourerAway() {
      return animate(380, function (progress) {
        placePourer(1 - progress, 1 - progress);
      }, easeInOut);
    }

    function hidePourer() {
      elements.pourer.setAttribute('opacity', '0');
    }

    function pourLiquid(pourerType, liquidColor, addedHeight) {
      const layer = { color: liquidColor, height: 0 };
      state.layers.push(layer);
      showPourer(pourerType);
      elements.stream.setAttribute('fill', shadeColor(liquidColor, 0.08));

      return animate(450, function (progress) {
        placePourer(progress, progress);
      }, easeOut)
        .then(function () {
          streamState.isPouring = true;
          elements.stream.setAttribute('opacity', '.92');

          return animate(1300, function (progress) {
            layer.height = addedHeight * progress;
            drawDrink();
          }, easeInOut);
        })
        .then(function () {
          streamState.isPouring = false;

          return animate(260, function (progress) {
            elements.stream.setAttribute('opacity', String(0.92 * (1 - progress)));
          });
        })
        .then(movePourerAway)
        .then(hidePourer);
    }

    function addCoffee(addedHeight) {
      const layer = { color: config.coffee, height: 0 };
      state.layers.push(layer);
      showPourer('coffee');

      const coffeeGrounds = [];

      for (let groundIndex = 0; groundIndex < 16; groundIndex++) {
        const coffeeGround = createSvgElement('circle', {
          r: 2.6 + (groundIndex % 3) * 0.7,
          fill: groundIndex % 2 ? '#3a2214' : '#5a3a26',
          opacity: 0,
          cx: 128 + ((groundIndex * 7) % 14),
          cy: 54
        });
        elements.effectsGroup.appendChild(coffeeGround);
        coffeeGrounds.push(coffeeGround);
      }

      return animate(450, function (progress) {
        placePourer(progress, progress * 1.2);
      }, easeOut)
        .then(function () {
          return animate(1500, function (progress) {
            const elapsedMs = progress * 1500;
            const surfaceY = getSurfaceY();

            coffeeGrounds.forEach(function (coffeeGround, groundIndex) {
              const fallProgress = clamp((elapsedMs - groundIndex * 55) / 420, 0, 1);
              coffeeGround.setAttribute('cy', 54 + fallProgress * Math.max(0, surfaceY - 58));
              coffeeGround.setAttribute('opacity', fallProgress > 0 && fallProgress < 1 ? '1' : '0');
            });

            layer.height = addedHeight * clamp((progress - 0.15) / 0.85, 0, 1);
            drawDrink();
          });
        })
        .then(function () {
          elements.effectsGroup.replaceChildren();
          return movePourerAway();
        })
        .then(hidePourer);
    }

    function addSugar() {
      showPourer('sugar');

      const sugarCube = createSvgElement('rect', {
        x: -8,
        y: -8,
        width: 16,
        height: 16,
        rx: 3,
        fill: '#fff',
        stroke: '#e1e4e8',
        'stroke-width': 1.5
      });
      elements.effectsGroup.appendChild(sugarCube);

      const surfaceY = getSurfaceY();
      elements.pourer.setAttribute('opacity', '0');

      return animate(650, function (progress) {
        const cubeX = 130 + Math.sin(progress * 6) * 6;
        const cubeY = 20 + progress * (surfaceY - 24 - 20);
        sugarCube.setAttribute('transform', 'translate(' + cubeX + ',' + cubeY + ') rotate(' + (progress * 220) + ')');
        sugarCube.setAttribute('opacity', '1');
      }, easeIn)
        .then(function () {
          return animate(900, function (progress) {
            sugarCube.setAttribute('transform', 'translate(130,' + (surfaceY - 4 + progress * 6) + ') rotate(220) scale(' + (1 - progress * 0.85) + ')');
            sugarCube.setAttribute('opacity', String(1 - progress));
          });
        })
        .then(function () {
          if (sugarCube.parentNode) {
            sugarCube.parentNode.removeChild(sugarCube);
          }
        });
    }

    function getFinalColor() {
      if (state.base === 'milk') {
        return mixColors(config.coffee, config.milk, 0.55);
      }

      return mixColors(config.coffee, config.water, 0.12);
    }

    function stirDrink() {
      const startColors = state.layers.map(function (layer) {
        return layer.color;
      });
      const targetColor = getFinalColor();
      const surfaceY = getSurfaceY();
      const totalHeight = state.layers.reduce(function (heightSum, layer) {
        return heightSum + layer.height;
      }, 0);

      elements.spoon.setAttribute('opacity', '1');
      elements.swirl.setAttribute('opacity', '1');

      return animate(2600, function (progress) {
        const angle = progress * Math.PI * 2 * 4;
        const radius = 22 * Math.sin(Math.min(1, progress * 6) * Math.PI / 2) * (progress > 0.9 ? (1 - progress) * 10 : 1);
        const spoonX = 130 + Math.cos(angle) * radius;
        const spoonY = surfaceY + 4 + Math.sin(angle) * radius * 0.22;

        elements.spoonLine.setAttribute('x2', spoonX);
        elements.spoonLine.setAttribute('y2', spoonY);
        elements.spoonBowl.setAttribute('cx', spoonX);
        elements.spoonBowl.setAttribute('cy', spoonY);

        const swirlScaleX = cupHalfWidthAt(surfaceY) / 62;
        const swirlScaleY = cupHalfWidthAt(surfaceY) / 62 * 0.3;
        elements.swirl.setAttribute('transform', 'translate(130,' + (surfaceY + 2) + ') rotate(' + (angle * 57.3) + ') scale(' + swirlScaleX + ',' + swirlScaleY + ')');

        const mixAmount = clamp((progress - 0.1) / 0.75, 0, 1);
        state.layers.forEach(function (layer, layerIndex) {
          layer.color = mixColors(startColors[layerIndex], targetColor, mixAmount);
        });
        drawDrink();
      }).then(function () {
        state.layers.forEach(function (layer) {
          if (layer.node && layer.node.parentNode) {
            layer.node.parentNode.removeChild(layer.node);
          }
        });
        state.layers = [{ color: targetColor, height: totalHeight }];
        state.done = true;
        drawDrink();

        return animate(450, function (progress) {
          elements.spoon.setAttribute('opacity', String(1 - progress));
          elements.swirl.setAttribute('opacity', String(1 - progress));
        });
      });
    }

    /* ---------- step panel ---------- */

    function createButton(label, extraClass, onClick) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'jp-bg__btn' + (extraClass ? ' ' + extraClass : '');
      button.textContent = label;
      button.addEventListener('click', onClick);
      return button;
    }

    function setControlsLocked(isLocked) {
      isBusy = isLocked;

      Array.prototype.forEach.call(elements.controls.querySelectorAll('button'), function (controlButton) {
        controlButton.disabled = isLocked;
      });
    }

    /* Runs one animated action with the buttons locked, then calls onDone. */
    function runAction(startAction, onDone) {
      if (isBusy) {
        return;
      }

      const ownSessionId = sessionId;
      setControlsLocked(true);

      startAction().then(function () {
        if (ownSessionId !== sessionId) {
          return;
        }

        setControlsLocked(false);

        if (onDone) {
          onDone();
        }
      }, function () {
        /* cancelled: the guide was restarted or closed meanwhile */
      });
    }

    function bounceCup(durationMs, heightPx) {
      animate(durationMs, function (progress) {
        elements.cupWrap.style.translate = '0 ' + (-Math.sin(progress * Math.PI) * heightPx) + 'px';
      }).catch(function () {});
    }

    function renderDots(activeStepIndex) {
      elements.dots.replaceChildren();

      steps.forEach(function (step, stepIndex) {
        const dot = document.createElement('span');
        dot.className = 'jp-bg__dot' + (stepIndex <= activeStepIndex ? ' is-on' : '');
        elements.dots.appendChild(dot);
      });
    }

    function goToNextStep() {
      state.stepIndex++;

      if (state.stepIndex >= steps.length) {
        return showFinished();
      }

      showStep();
    }

    function showFinished() {
      renderDots(Infinity);
      elements.stepLabel.textContent = '';
      elements.stepTitle.textContent = labels.readyTitle;
      elements.stepText.textContent = labels.readyText;
      elements.controls.replaceChildren();
      elements.stage.classList.add('is-done');
      bounceCup(700, 8);
    }

    function renderCupStep() {
      const swatchList = document.createElement('div');
      swatchList.className = 'jp-bg__swatches';

      config.cups.forEach(function (cup, cupIndex) {
        const swatchButton = document.createElement('button');
        swatchButton.type = 'button';
        swatchButton.className = 'jp-bg__swatch' + (cupIndex === state.cupIndex ? ' is-on' : '');
        swatchButton.style.background = cup.color;
        swatchButton.setAttribute('aria-label', cup.name);
        swatchButton.title = cup.name;

        swatchButton.addEventListener('click', function () {
          selectCup(cupIndex);

          Array.prototype.forEach.call(swatchList.children, function (swatch, swatchIndex) {
            swatch.classList.toggle('is-on', swatchIndex === cupIndex);
          });

          bounceCup(420, 10);
        });

        swatchList.appendChild(swatchButton);
      });

      elements.controls.appendChild(swatchList);
      elements.controls.appendChild(createButton(labels.next, '', function () {
        goToNextStep();
      }));
    }

    function renderBaseStep() {
      elements.controls.appendChild(createButton(labels.water, '', function () {
        runAction(function () {
          state.base = 'water';
          return pourLiquid('water', config.water, 58);
        }, goToNextStep);
      }));

      elements.controls.appendChild(createButton(labels.milk, 'jp-bg__btn--ghost', function () {
        runAction(function () {
          state.base = 'milk';
          return pourLiquid('milk', config.milk, 58);
        }, goToNextStep);
      }));
    }

    function renderCoffeeStep() {
      elements.controls.appendChild(createButton(labels.coffee, '', function () {
        runAction(function () {
          if (!state.base) {
            state.base = 'water';
          }

          return addCoffee(34);
        }, goToNextStep);
      }));
    }

    function renderSugarStep() {
      const sugarCounter = document.createElement('span');
      sugarCounter.className = 'jp-bg__count';
      sugarCounter.textContent = '0 / 3';

      const skipButton = createButton(labels.skip, 'jp-bg__btn--ghost', function () {
        goToNextStep();
      });

      const addSugarButton = createButton(labels.sugar, '', function () {
        if (state.sugarCount >= 3) {
          return;
        }

        runAction(function () {
          state.sugarCount++;
          return addSugar();
        }, function () {
          sugarCounter.textContent = state.sugarCount + ' / 3';
          skipButton.textContent = labels.next;

          if (state.sugarCount >= 3) {
            addSugarButton.disabled = true;
          }
        });
      });

      elements.controls.appendChild(addSugarButton);
      elements.controls.appendChild(skipButton);
      elements.controls.appendChild(sugarCounter);
    }

    function renderStirStep() {
      /* Nothing was poured yet (the base step was removed): start with hot water. */
      if (!state.layers.length) {
        state.base = 'water';
        state.layers.push({ color: config.water, height: 58 });
        drawDrink();
      }

      elements.controls.appendChild(createButton(labels.stir, '', function () {
        runAction(stirDrink, goToNextStep);
      }));
    }

    function showStep() {
      const currentStep = steps[state.stepIndex];

      renderDots(state.stepIndex);
      elements.stepLabel.textContent = labels.step + ' ' + (state.stepIndex + 1) + ' ' + labels.of + ' ' + steps.length;
      elements.stepTitle.textContent = currentStep.title;
      elements.stepText.textContent = currentStep.text;
      elements.controls.replaceChildren();

      if (currentStep.action === 'cup') {
        renderCupStep();
      } else if (currentStep.action === 'base') {
        renderBaseStep();
      } else if (currentStep.action === 'coffee') {
        renderCoffeeStep();
      } else if (currentStep.action === 'sugar') {
        renderSugarStep();
      } else if (currentStep.action === 'stir') {
        renderStirStep();
      }
    }

    /* ---------- open / close ---------- */

    function stopAnimations() {
      sessionId++;
      isBusy = false;
      streamState.isPouring = false;
    }

    function openGuide() {
      /* no step blocks yet: nothing to show */
      if (!steps.length) {
        return;
      }

      resetGame();

      if (typeof brewDialog.showModal === 'function') {
        if (!brewDialog.open) {
          brewDialog.showModal();
        }
      } else {
        brewDialog.setAttribute('open', '');
      }
    }

    function closeGuide() {
      stopAnimations();

      if (typeof brewDialog.close === 'function') {
        brewDialog.close();
      } else {
        brewDialog.removeAttribute('open');
      }
    }

    function onOpenClick(event) {
      /* stop listening when the section was re-rendered (theme editor) */
      if (!brewDialog.isConnected) {
        document.removeEventListener('click', onOpenClick);
        return;
      }

      const openTrigger = event.target.closest && event.target.closest('[data-jp-brew-open]');

      if (openTrigger) {
        event.preventDefault();
        openGuide();
      }
    }

    document.addEventListener('click', onOpenClick);
    queryInDialog('[data-close]').addEventListener('click', closeGuide);

    queryInDialog('[data-restart]').addEventListener('click', function () {
      if (!isBusy) {
        resetGame();
      }
    });

    /* A click on the backdrop lands on the dialog itself. */
    brewDialog.addEventListener('click', function (event) {
      if (event.target === brewDialog) {
        closeGuide();
      }
    });

    /* Esc closes the dialog without going through closeGuide(): stop any running animation too */
    brewDialog.addEventListener('close', stopAnimations);

    /* 3D tilt of the cup following the pointer */
    elements.stage.addEventListener('pointermove', function (event) {
      if (motionScale < 1) {
        return;
      }

      const stageRect = elements.stage.getBoundingClientRect();
      const pointerX = (event.clientX - stageRect.left) / stageRect.width - 0.5;
      const pointerY = (event.clientY - stageRect.top) / stageRect.height - 0.5;
      elements.cupWrap.style.transform = 'rotateY(' + (pointerX * 22) + 'deg) rotateX(' + (-pointerY * 12) + 'deg)';
    });

    elements.stage.addEventListener('pointerleave', function () {
      elements.cupWrap.style.transform = '';
    });

    if (config.preview && window.Shopify && window.Shopify.designMode) {
      openGuide();
    }
  }

  /* ---------- start ---------- */

  function initAllBrewGuides(scope) {
    scope.querySelectorAll('[data-jp-brew]').forEach(initBrewGuide);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initAllBrewGuides(document);
    });
  } else {
    initAllBrewGuides(document);
  }

  document.addEventListener('shopify:section:load', function (event) {
    initAllBrewGuides(event.target);
  });
})();
