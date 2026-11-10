/*
  JP Brew guide (sections/jp-brew-guide.liquid)
  An interactive "make your coffee" pop-up. It opens when a visitor clicks any element with
  the attribute data-jp-brew-open. Every <dialog data-jp-brew> on the page is set up once,
  on page load and again when the theme editor re-renders the section.
  Steps, texts and colors come from the <script type="application/json"
  data-jp-brew-settings> block in the dialog.

  Sections of this file:
  1. Constants (cup geometry, animation timings and amounts)
  2. Color and math helpers
  3. BrewGuide: one pop-up (setup, animation loop, drink drawing, pourers, actions,
     step panel, open / close)
  4. Start-up

  All coordinates are in the units of the cup <svg> viewBox (0 0 280 290).
*/
(function () {
  /* ---------- 1. constants ---------- */

  const ANIMATION_CANCELLED_ERROR = new Error('cancelled');
  const REDUCED_MOTION_SCALE = 0.01;
  const RADIANS_TO_DEGREES = 57.3;
  const WHITE_HEX = '#ffffff';
  const BLACK_HEX = '#000000';

  /* Cup geometry */
  const CUP_CENTER_X = 130;
  const CUP_BOTTOM_Y = 216;
  const CUP_STRAIGHT_WALL_BOTTOM_Y = 150;
  const CUP_TAPER_HEIGHT = 66;
  const CUP_INNER_HALF_WIDTH = 70;
  const CUP_TAPER_NARROWING = 42;
  const CUP_RIM_LIGHTEN_AMOUNT = 0.12;
  const DEFAULT_CUP_NUMBER = 1;

  /* Drink layers and surface */
  const BOTTOM_LAYER_EXTRA_HEIGHT = 30;
  const LAYER_SEAM_OVERLAP = 0.6;
  const MIN_VISIBLE_DRINK_HEIGHT = 0.5;
  const SURFACE_INSET = 2;
  const SURFACE_FLATTEN_RATIO = 0.16;
  const SURFACE_LIGHTEN_AMOUNT = 0.14;
  const STIRRED_SURFACE_LIGHTEN_AMOUNT = 0.06;
  const BASE_LIQUID_HEIGHT = 58;
  const COFFEE_LAYER_HEIGHT = 34;

  /* Pourers and pour stream */
  const STREAM_TOP_Y = 52;
  const STREAM_OPACITY = 0.92;
  const STREAM_LIGHTEN_AMOUNT = 0.08;
  const POURER_AWAY_X = 262;
  const POURER_TRAVEL_X = 100;
  const POURER_AWAY_Y = -20;
  const POURER_TRAVEL_Y = 64;
  const POURER_POUR_ANGLE_DEGREES = -20;
  const POURER_FADE_IN_SPEED = 1.6;
  const POURER_ARRIVE_DURATION_MS = 450;
  const POURER_LEAVE_DURATION_MS = 380;
  const POUR_DURATION_MS = 1300;
  const STREAM_FADE_DURATION_MS = 260;

  /* Coffee scoop and grounds */
  const SCOOP_TILT_FACTOR = 1.2;
  const COFFEE_POUR_DURATION_MS = 1500;
  const COFFEE_GROUND_COUNT = 16;
  const COFFEE_GROUND_BASE_RADIUS = 2.6;
  const COFFEE_GROUND_RADIUS_STEP = 0.7;
  const COFFEE_GROUND_SIZE_COUNT = 3;
  const COFFEE_GROUND_START_X = 128;
  const COFFEE_GROUND_SPREAD_STEP = 7;
  const COFFEE_GROUND_SPREAD_WIDTH = 14;
  const COFFEE_GROUND_START_Y = 54;
  const COFFEE_GROUND_FALL_END_OFFSET = 58;
  const COFFEE_GROUND_DROP_DELAY_MS = 55;
  const COFFEE_GROUND_FALL_DURATION_MS = 420;
  const COFFEE_FILL_START_PROGRESS = 0.15;
  const COFFEE_FILL_PROGRESS_SPAN = 0.85;

  /* Sugar */
  const MAX_SUGAR_CUBES = 3;
  const SUGAR_DROP_DURATION_MS = 650;
  const SUGAR_DISSOLVE_DURATION_MS = 900;
  const SUGAR_START_Y = 20;
  const SUGAR_STOP_ABOVE_SURFACE = 24;
  const SUGAR_WOBBLE_FREQUENCY = 6;
  const SUGAR_WOBBLE_AMPLITUDE = 6;
  const SUGAR_SPIN_DEGREES = 220;
  const SUGAR_FLOAT_OFFSET = 4;
  const SUGAR_SINK_DISTANCE = 6;
  const SUGAR_SHRINK_AMOUNT = 0.85;

  /* Stirring */
  const STIR_DURATION_MS = 2600;
  const STIR_TURNS = 4;
  const SPOON_ORBIT_MAX_RADIUS = 22;
  const SPOON_WIDEN_SPEED = 6;
  const SPOON_SETTLE_START_PROGRESS = 0.9;
  const SPOON_SETTLE_SPEED = 10;
  const SPOON_DEPTH = 4;
  const SPOON_ORBIT_FLATTEN_RATIO = 0.22;
  const SPOON_FADE_DURATION_MS = 450;
  const SWIRL_HALF_WIDTH = 62;
  const SWIRL_FLATTEN_RATIO = 0.3;
  const SWIRL_DEPTH = 2;
  const STIR_MIX_START_PROGRESS = 0.1;
  const STIR_MIX_PROGRESS_SPAN = 0.75;
  const MILK_MIX_AMOUNT = 0.55;
  const WATER_MIX_AMOUNT = 0.12;

  /* Cup bounce and pointer tilt */
  const FINISHED_BOUNCE_DURATION_MS = 700;
  const FINISHED_BOUNCE_HEIGHT_PX = 8;
  const SWATCH_BOUNCE_DURATION_MS = 420;
  const SWATCH_BOUNCE_HEIGHT_PX = 10;
  const CUP_TILT_Y_DEGREES = 22;
  const CUP_TILT_X_DEGREES = 12;

  /* ---------- 2. color and math helpers ---------- */

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
      parseInt(hexDigits.slice(0, 2), 16),
      parseInt(hexDigits.slice(2, 4), 16),
      parseInt(hexDigits.slice(4, 6), 16)
    ];
  }

  function rgbToHex(rgbChannels) {
    const hexPairs = rgbChannels.map(function (channel) {
      const roundedChannel = Math.max(0, Math.min(255, Math.round(channel)));
      return (roundedChannel < 16 ? '0' : '') + roundedChannel.toString(16);
    });

    return '#' + hexPairs.join('');
  }

  /* Mixes startColor into endColor. amount 0 = startColor, 1 = endColor. */
  function mixColors(startColor, endColor, amount) {
    const startRgb = hexToRgb(startColor);
    const endRgb = hexToRgb(endColor);

    return rgbToHex([
      startRgb[0] + (endRgb[0] - startRgb[0]) * amount,
      startRgb[1] + (endRgb[1] - startRgb[1]) * amount,
      startRgb[2] + (endRgb[2] - startRgb[2]) * amount
    ]);
  }

  /* Positive amount lightens towards white, negative darkens towards black. */
  function shadeColor(colorHex, amount) {
    if (amount >= 0) {
      return mixColors(colorHex, WHITE_HEX, amount);
    }

    return mixColors(colorHex, BLACK_HEX, -amount);
  }

  /* Half of the inside width of the cup at a given height (the cup narrows towards the bottom). */
  function getCupInnerHalfWidthAt(positionY) {
    if (positionY <= CUP_STRAIGHT_WALL_BOTTOM_Y) {
      return CUP_INNER_HALF_WIDTH;
    }

    const depthRatio = (positionY - CUP_STRAIGHT_WALL_BOTTOM_Y) / CUP_TAPER_HEIGHT;
    return CUP_INNER_HALF_WIDTH - depthRatio * depthRatio * CUP_TAPER_NARROWING;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  /* Standard cubic ease-out, quadratic ease-in-out and quadratic ease-in curves. */
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

  /* Copies a shape from the templates in snippets/jp-brew-shapes.liquid. */
  function cloneShape(dialogElement, shapeName) {
    const shapeTemplate = dialogElement.querySelector(
      '[data-jp-brew-shape-template="' + shapeName + '"]'
    );

    return shapeTemplate.content.firstElementChild.firstElementChild.cloneNode(true);
  }

  /* Replaces {current} and {total} in a label from the section settings. */
  function fillCounterLabel(label, currentValue, totalValue) {
    return String(label)
      .replace('{current}', currentValue)
      .replace('{total}', totalValue);
  }

  /* Returns the parsed JSON settings of a dialog, or null when missing or invalid. */
  function readBrewSettings(brewDialog) {
    const settingsElement = brewDialog.querySelector('[data-jp-brew-settings]');

    if (!settingsElement) {
      return null;
    }

    try {
      return JSON.parse(settingsElement.textContent);
    } catch (error) {
      return null;
    }
  }

  /* ---------- 3. one brew guide ---------- */

  class BrewGuide {
    constructor(brewDialog, brewSettings) {
      this.brewDialog = brewDialog;
      this.brewSettings = brewSettings;
      this.labels = brewSettings.labels;
      this.steps = brewSettings.steps || [];

      const prefersReducedMotion = window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.motionScale = prefersReducedMotion ? REDUCED_MOTION_SCALE : 1;

      this.dialogElements = {
        stage: this.queryInDialog('[data-jp-brew-stage]'),
        cupWrap: this.queryInDialog('[data-jp-brew-cup-wrap]'),
        layerGroup: this.queryInDialog('[data-jp-brew-layers]'),
        surface: this.queryInDialog('[data-jp-brew-surface]'),
        swirl: this.queryInDialog('[data-jp-brew-swirl]'),
        stream: this.queryInDialog('[data-jp-brew-stream]'),
        effectsGroup: this.queryInDialog('[data-jp-brew-effects]'),
        spoon: this.queryInDialog('[data-jp-brew-spoon]'),
        spoonLine: this.queryInDialog('[data-jp-brew-spoon-line]'),
        spoonBowl: this.queryInDialog('[data-jp-brew-spoon-bowl]'),
        pourer: this.queryInDialog('[data-jp-brew-pourer]'),
        cupBody: this.queryInDialog('[data-jp-brew-cup-body]'),
        cupHandle: this.queryInDialog('[data-jp-brew-cup-handle]'),
        cupRim: this.queryInDialog('[data-jp-brew-cup-rim]'),
        progressDotsContainer: this.queryInDialog('[data-jp-brew-progress-dots]'),
        stepLabel: this.queryInDialog('[data-jp-brew-step-label]'),
        stepTitle: this.queryInDialog('[data-jp-brew-step-title]'),
        stepText: this.queryInDialog('[data-jp-brew-step-text]'),
        controlsContainer: this.queryInDialog('[data-jp-brew-controls]')
      };

      /* Every reset starts a new session. Animations from an older session stop on their own,
         so closing and reopening the pop-up during a pour cannot change the new game. */
      this.animationSessionId = 0;
      this.gameState = null;
      this.isBusy = false;
      this.isStreamPouring = false;

      this.bindEvents();

      if (brewSettings.preview && window.Shopify && window.Shopify.designMode) {
        this.openGuide();
      }
    }

    queryInDialog(selector) {
      return this.brewDialog.querySelector(selector);
    }

    /* ---------- animation loop ---------- */

    animate(durationMs, onFrame, easing) {
      const scaledDurationMs = durationMs * this.motionScale;

      return new Promise((resolve, reject) => {
        const startTime = performance.now();
        const ownSessionId = this.animationSessionId;

        const renderFrame = (timestamp) => {
          if (ownSessionId !== this.animationSessionId) {
            reject(ANIMATION_CANCELLED_ERROR);
            return;
          }

          const progress = Math.min(1, (timestamp - startTime) / scaledDurationMs);
          onFrame(easing ? easing(progress) : progress);

          if (progress < 1) {
            requestAnimationFrame(renderFrame);
          } else {
            resolve();
          }
        };

        renderFrame(startTime);
      });
    }

    /* ---------- game state and drink drawing ---------- */

    resetGame() {
      this.animationSessionId++;
      this.isBusy = false;
      this.isStreamPouring = false;

      const maxCupIndex = this.brewSettings.cups.length - 1;
      const defaultCupNumber = parseInt(this.brewSettings.defaultCup, 10) || DEFAULT_CUP_NUMBER;
      const defaultCupIndex = Math.max(0, Math.min(maxCupIndex, defaultCupNumber - 1));

      this.gameState = {
        stepIndex: 0,
        cupIndex: defaultCupIndex,
        layers: [],
        baseLiquid: null,
        sugarCount: 0,
        isStirred: false
      };

      const dialogElements = this.dialogElements;
      dialogElements.layerGroup.replaceChildren();
      dialogElements.effectsGroup.replaceChildren();
      dialogElements.swirl.setAttribute('opacity', '0');
      dialogElements.spoon.setAttribute('opacity', '0');
      dialogElements.stream.setAttribute('opacity', '0');
      dialogElements.pourer.setAttribute('opacity', '0');
      dialogElements.stage.classList.remove('is-done');

      this.selectCup(this.gameState.cupIndex);
      this.drawDrink();
      this.showStep();
    }

    selectCup(cupIndex) {
      this.gameState.cupIndex = cupIndex;

      const cupColor = this.brewSettings.cups[cupIndex].color;
      this.dialogElements.cupBody.setAttribute('fill', cupColor);
      this.dialogElements.cupHandle.setAttribute('stroke', cupColor);
      this.dialogElements.cupRim.setAttribute(
        'fill',
        shadeColor(cupColor, CUP_RIM_LIGHTEN_AMOUNT)
      );
    }

    getSurfaceY() {
      let surfaceY = CUP_BOTTOM_Y;

      this.gameState.layers.forEach((layer) => {
        surfaceY -= layer.height;
      });

      return surfaceY;
    }

    drawDrink() {
      const dialogElements = this.dialogElements;
      const layers = this.gameState.layers;
      let currentY = CUP_BOTTOM_Y;

      layers.forEach((layer, layerIndex) => {
        if (!layer.shapeElement) {
          layer.shapeElement = cloneShape(this.brewDialog, 'layer');
          dialogElements.layerGroup.appendChild(layer.shapeElement);
        }

        const layerTopY = currentY - layer.height;
        const layerOverlap = layerIndex === 0 ? BOTTOM_LAYER_EXTRA_HEIGHT : LAYER_SEAM_OVERLAP;
        layer.shapeElement.setAttribute('y', layerTopY);
        layer.shapeElement.setAttribute('height', Math.max(0, layer.height + layerOverlap));
        layer.shapeElement.setAttribute('fill', layer.color);
        currentY = layerTopY;
      });

      const topLayer = layers.length ? layers[layers.length - 1] : null;

      if (topLayer && currentY < CUP_BOTTOM_Y - MIN_VISIBLE_DRINK_HEIGHT) {
        const surfaceRadiusX = getCupInnerHalfWidthAt(currentY) - SURFACE_INSET;
        const surfaceLightenAmount = this.gameState.isStirred
          ? STIRRED_SURFACE_LIGHTEN_AMOUNT
          : SURFACE_LIGHTEN_AMOUNT;
        dialogElements.surface.setAttribute('cx', CUP_CENTER_X);
        dialogElements.surface.setAttribute('cy', currentY);
        dialogElements.surface.setAttribute('rx', surfaceRadiusX);
        dialogElements.surface.setAttribute('ry', surfaceRadiusX * SURFACE_FLATTEN_RATIO);
        dialogElements.surface.setAttribute(
          'fill',
          shadeColor(topLayer.color, surfaceLightenAmount)
        );
        dialogElements.surface.setAttribute('opacity', '1');
      } else {
        dialogElements.surface.setAttribute('opacity', '0');
      }

      if (this.isStreamPouring) {
        dialogElements.stream.setAttribute('height', Math.max(0, currentY - STREAM_TOP_Y));
      }
    }

    /* ---------- pourers (kettle, milk jug, coffee scoop) ---------- */

    showPourer(pourerType) {
      const pourerGroups = this.dialogElements.pourer.querySelectorAll(
        '[data-jp-brew-pourer-type]'
      );

      pourerGroups.forEach((pourerGroup) => {
        if (pourerGroup.getAttribute('data-jp-brew-pourer-type') === pourerType) {
          pourerGroup.removeAttribute('display');
        } else {
          pourerGroup.setAttribute('display', 'none');
        }
      });

      this.dialogElements.pourer.setAttribute('opacity', '1');
    }

    /* positionProgress: 0 = away (top right), 1 = in place above the cup.
       tiltProgress: 0 = upright, 1 = pouring. */
    placePourer(positionProgress, tiltProgress) {
      const pourerX = POURER_AWAY_X - POURER_TRAVEL_X * positionProgress;
      const pourerY = POURER_AWAY_Y + POURER_TRAVEL_Y * positionProgress;
      const pourerAngle = POURER_POUR_ANGLE_DEGREES * tiltProgress;
      const pourerOpacity = clamp(positionProgress * POURER_FADE_IN_SPEED, 0, 1);

      this.dialogElements.pourer.setAttribute(
        'transform',
        'translate(' + pourerX + ',' + pourerY + ') rotate(' + pourerAngle + ')'
      );
      this.dialogElements.pourer.setAttribute('opacity', String(pourerOpacity));
    }

    movePourerAway() {
      return this.animate(POURER_LEAVE_DURATION_MS, (progress) => {
        this.placePourer(1 - progress, 1 - progress);
      }, easeInOut);
    }

    hidePourer() {
      this.dialogElements.pourer.setAttribute('opacity', '0');
    }

    /* ---------- animated actions ---------- */

    pourLiquid(pourerType, liquidColor, targetLayerHeight) {
      const dialogElements = this.dialogElements;
      const layer = { color: liquidColor, height: 0 };
      this.gameState.layers.push(layer);
      this.showPourer(pourerType);
      dialogElements.stream.setAttribute('fill', shadeColor(liquidColor, STREAM_LIGHTEN_AMOUNT));

      return this.animate(POURER_ARRIVE_DURATION_MS, (progress) => {
        this.placePourer(progress, progress);
      }, easeOut)
        .then(() => {
          this.isStreamPouring = true;
          dialogElements.stream.setAttribute('opacity', String(STREAM_OPACITY));

          return this.animate(POUR_DURATION_MS, (progress) => {
            layer.height = targetLayerHeight * progress;
            this.drawDrink();
          }, easeInOut);
        })
        .then(() => {
          this.isStreamPouring = false;

          return this.animate(STREAM_FADE_DURATION_MS, (progress) => {
            dialogElements.stream.setAttribute('opacity', String(STREAM_OPACITY * (1 - progress)));
          });
        })
        .then(() => this.movePourerAway())
        .then(() => this.hidePourer());
    }

    createCoffeeGrounds() {
      const coffeeGrounds = [];

      for (let groundIndex = 0; groundIndex < COFFEE_GROUND_COUNT; groundIndex++) {
        const coffeeGround = cloneShape(this.brewDialog, 'coffee-ground');
        const groundRadius = COFFEE_GROUND_BASE_RADIUS
          + (groundIndex % COFFEE_GROUND_SIZE_COUNT) * COFFEE_GROUND_RADIUS_STEP;
        const groundX = COFFEE_GROUND_START_X
          + ((groundIndex * COFFEE_GROUND_SPREAD_STEP) % COFFEE_GROUND_SPREAD_WIDTH);
        const groundColor = groundIndex % 2
          ? this.brewSettings.coffeeGroundDark
          : this.brewSettings.coffeeGroundLight;

        coffeeGround.setAttribute('r', groundRadius);
        coffeeGround.setAttribute('fill', groundColor);
        coffeeGround.setAttribute('cx', groundX);
        this.dialogElements.effectsGroup.appendChild(coffeeGround);
        coffeeGrounds.push(coffeeGround);
      }

      return coffeeGrounds;
    }

    addCoffee(targetLayerHeight) {
      const layer = { color: this.brewSettings.coffee, height: 0 };
      this.gameState.layers.push(layer);
      this.showPourer('coffee');

      const coffeeGrounds = this.createCoffeeGrounds();

      return this.animate(POURER_ARRIVE_DURATION_MS, (progress) => {
        this.placePourer(progress, progress * SCOOP_TILT_FACTOR);
      }, easeOut)
        .then(() => {
          return this.animate(COFFEE_POUR_DURATION_MS, (progress) => {
            const elapsedMs = progress * COFFEE_POUR_DURATION_MS;
            const surfaceY = this.getSurfaceY();
            const fallDistance = Math.max(0, surfaceY - COFFEE_GROUND_FALL_END_OFFSET);

            coffeeGrounds.forEach((coffeeGround, groundIndex) => {
              const fallProgress = clamp(
                (elapsedMs - groundIndex * COFFEE_GROUND_DROP_DELAY_MS)
                  / COFFEE_GROUND_FALL_DURATION_MS,
                0,
                1
              );
              const isFalling = fallProgress > 0 && fallProgress < 1;
              coffeeGround.setAttribute('cy', COFFEE_GROUND_START_Y + fallProgress * fallDistance);
              coffeeGround.setAttribute('opacity', isFalling ? '1' : '0');
            });

            const fillProgress = clamp(
              (progress - COFFEE_FILL_START_PROGRESS) / COFFEE_FILL_PROGRESS_SPAN,
              0,
              1
            );
            layer.height = targetLayerHeight * fillProgress;
            this.drawDrink();
          });
        })
        .then(() => {
          this.dialogElements.effectsGroup.replaceChildren();
          return this.movePourerAway();
        })
        .then(() => this.hidePourer());
    }

    /* The cube is dropped on its own: no pourer is shown for sugar. */
    addSugar() {
      const sugarCube = cloneShape(this.brewDialog, 'sugar-cube');
      this.dialogElements.effectsGroup.appendChild(sugarCube);

      const surfaceY = this.getSurfaceY();
      const dropDistance = surfaceY - SUGAR_STOP_ABOVE_SURFACE - SUGAR_START_Y;

      return this.animate(SUGAR_DROP_DURATION_MS, (progress) => {
        const cubeX = CUP_CENTER_X
          + Math.sin(progress * SUGAR_WOBBLE_FREQUENCY) * SUGAR_WOBBLE_AMPLITUDE;
        const cubeY = SUGAR_START_Y + progress * dropDistance;
        const cubeAngle = progress * SUGAR_SPIN_DEGREES;
        sugarCube.setAttribute(
          'transform',
          'translate(' + cubeX + ',' + cubeY + ') rotate(' + cubeAngle + ')'
        );
        sugarCube.setAttribute('opacity', '1');
      }, easeIn)
        .then(() => {
          return this.animate(SUGAR_DISSOLVE_DURATION_MS, (progress) => {
            const cubeY = surfaceY - SUGAR_FLOAT_OFFSET + progress * SUGAR_SINK_DISTANCE;
            const cubeScale = 1 - progress * SUGAR_SHRINK_AMOUNT;
            sugarCube.setAttribute(
              'transform',
              'translate(' + CUP_CENTER_X + ',' + cubeY + ') rotate(' + SUGAR_SPIN_DEGREES
                + ') scale(' + cubeScale + ')'
            );
            sugarCube.setAttribute('opacity', String(1 - progress));
          });
        })
        .then(() => {
          if (sugarCube.parentNode) {
            sugarCube.parentNode.removeChild(sugarCube);
          }
        });
    }

    getFinalColor() {
      if (this.gameState.baseLiquid === 'milk') {
        return mixColors(this.brewSettings.coffee, this.brewSettings.milk, MILK_MIX_AMOUNT);
      }

      return mixColors(this.brewSettings.coffee, this.brewSettings.water, WATER_MIX_AMOUNT);
    }

    /* One frame of the stir: moves the spoon and swirl and blends the layer colors. */
    drawStirFrame(progress, surfaceY, startColors, targetColor) {
      const dialogElements = this.dialogElements;
      const spoonAngleRadians = progress * Math.PI * 2 * STIR_TURNS;
      const spoonWidenProgress = Math.min(1, progress * SPOON_WIDEN_SPEED);
      const spoonSettleFactor = progress > SPOON_SETTLE_START_PROGRESS
        ? (1 - progress) * SPOON_SETTLE_SPEED
        : 1;
      const spoonOrbitRadius = SPOON_ORBIT_MAX_RADIUS
        * Math.sin(spoonWidenProgress * Math.PI / 2)
        * spoonSettleFactor;
      const spoonX = CUP_CENTER_X + Math.cos(spoonAngleRadians) * spoonOrbitRadius;
      const spoonY = surfaceY
        + SPOON_DEPTH
        + Math.sin(spoonAngleRadians) * spoonOrbitRadius * SPOON_ORBIT_FLATTEN_RATIO;

      dialogElements.spoonLine.setAttribute('x2', spoonX);
      dialogElements.spoonLine.setAttribute('y2', spoonY);
      dialogElements.spoonBowl.setAttribute('cx', spoonX);
      dialogElements.spoonBowl.setAttribute('cy', spoonY);

      const swirlScaleX = getCupInnerHalfWidthAt(surfaceY) / SWIRL_HALF_WIDTH;
      const swirlScaleY = getCupInnerHalfWidthAt(surfaceY) / SWIRL_HALF_WIDTH * SWIRL_FLATTEN_RATIO;
      const swirlAngle = spoonAngleRadians * RADIANS_TO_DEGREES;
      dialogElements.swirl.setAttribute(
        'transform',
        'translate(' + CUP_CENTER_X + ',' + (surfaceY + SWIRL_DEPTH) + ') rotate(' + swirlAngle
          + ') scale(' + swirlScaleX + ',' + swirlScaleY + ')'
      );

      const mixAmount = clamp(
        (progress - STIR_MIX_START_PROGRESS) / STIR_MIX_PROGRESS_SPAN,
        0,
        1
      );
      this.gameState.layers.forEach((layer, layerIndex) => {
        layer.color = mixColors(startColors[layerIndex], targetColor, mixAmount);
      });
      this.drawDrink();
    }

    /* Replaces all layers with one layer of the final color. */
    mergeLayers(targetColor, totalHeight) {
      this.gameState.layers.forEach((layer) => {
        if (layer.shapeElement && layer.shapeElement.parentNode) {
          layer.shapeElement.parentNode.removeChild(layer.shapeElement);
        }
      });
      this.gameState.layers = [{ color: targetColor, height: totalHeight }];
      this.gameState.isStirred = true;
      this.drawDrink();
    }

    stirDrink() {
      const dialogElements = this.dialogElements;
      const startColors = this.gameState.layers.map((layer) => {
        return layer.color;
      });
      const targetColor = this.getFinalColor();
      const surfaceY = this.getSurfaceY();
      const totalHeight = this.gameState.layers.reduce((heightSum, layer) => {
        return heightSum + layer.height;
      }, 0);

      dialogElements.spoon.setAttribute('opacity', '1');
      dialogElements.swirl.setAttribute('opacity', '1');

      return this.animate(STIR_DURATION_MS, (progress) => {
        this.drawStirFrame(progress, surfaceY, startColors, targetColor);
      }).then(() => {
        this.mergeLayers(targetColor, totalHeight);

        return this.animate(SPOON_FADE_DURATION_MS, (progress) => {
          dialogElements.spoon.setAttribute('opacity', String(1 - progress));
          dialogElements.swirl.setAttribute('opacity', String(1 - progress));
        });
      });
    }

    /* ---------- step panel ---------- */

    createButton(label, extraClass, onClick) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'jp-bg__btn' + (extraClass ? ' ' + extraClass : '');
      button.textContent = label;
      button.addEventListener('click', onClick);
      return button;
    }

    setControlsLocked(isLocked) {
      this.isBusy = isLocked;

      const controlButtons = this.dialogElements.controlsContainer.querySelectorAll('button');
      controlButtons.forEach((controlButton) => {
        controlButton.disabled = isLocked;
      });
    }

    /* Runs one animated action with the buttons locked, then calls onDone. */
    runAction(startAction, onDone) {
      if (this.isBusy) {
        return;
      }

      const ownSessionId = this.animationSessionId;
      this.setControlsLocked(true);

      startAction().then(() => {
        if (ownSessionId !== this.animationSessionId) {
          return;
        }

        this.setControlsLocked(false);

        if (onDone) {
          onDone();
        }
      }, (error) => {
        /* cancelled: the guide was restarted or closed meanwhile */
        if (error !== ANIMATION_CANCELLED_ERROR) {
          throw error;
        }
      });
    }

    bounceCup(durationMs, heightPx) {
      this.animate(durationMs, (progress) => {
        const offsetY = -Math.sin(progress * Math.PI) * heightPx;
        this.dialogElements.cupWrap.style.translate = '0 ' + offsetY + 'px';
      }).catch((error) => {
        if (error !== ANIMATION_CANCELLED_ERROR) {
          throw error;
        }
      });
    }

    renderProgressDots(activeStepIndex) {
      const progressDotsContainer = this.dialogElements.progressDotsContainer;
      progressDotsContainer.replaceChildren();

      for (let stepIndex = 0; stepIndex < this.steps.length; stepIndex++) {
        const progressDot = document.createElement('span');
        progressDot.className = 'jp-bg__dot' + (stepIndex <= activeStepIndex ? ' is-on' : '');
        progressDotsContainer.appendChild(progressDot);
      }
    }

    goToNextStep() {
      this.gameState.stepIndex++;

      if (this.gameState.stepIndex >= this.steps.length) {
        this.showFinished();
        return;
      }

      this.showStep();
    }

    showFinished() {
      const dialogElements = this.dialogElements;
      this.renderProgressDots(Infinity);
      dialogElements.stepLabel.textContent = '';
      dialogElements.stepTitle.textContent = this.labels.readyTitle;
      dialogElements.stepText.textContent = this.labels.readyText;
      dialogElements.controlsContainer.replaceChildren();
      dialogElements.stage.classList.add('is-done');
      this.bounceCup(FINISHED_BOUNCE_DURATION_MS, FINISHED_BOUNCE_HEIGHT_PX);
    }

    renderCupStep() {
      const controlsContainer = this.dialogElements.controlsContainer;
      const swatchList = document.createElement('div');
      swatchList.className = 'jp-bg__swatches';

      this.brewSettings.cups.forEach((cup, cupIndex) => {
        const swatchButton = document.createElement('button');
        swatchButton.type = 'button';
        swatchButton.className = 'jp-bg__swatch'
          + (cupIndex === this.gameState.cupIndex ? ' is-on' : '');
        swatchButton.style.background = cup.color;
        swatchButton.setAttribute('aria-label', cup.name);
        swatchButton.title = cup.name;

        swatchButton.addEventListener('click', () => {
          this.selectCup(cupIndex);

          Array.from(swatchList.children).forEach((swatch, swatchIndex) => {
            swatch.classList.toggle('is-on', swatchIndex === cupIndex);
          });

          this.bounceCup(SWATCH_BOUNCE_DURATION_MS, SWATCH_BOUNCE_HEIGHT_PX);
        });

        swatchList.appendChild(swatchButton);
      });

      controlsContainer.appendChild(swatchList);
      controlsContainer.appendChild(this.createButton(this.labels.next, '', () => {
        this.goToNextStep();
      }));
    }

    renderBaseStep() {
      const controlsContainer = this.dialogElements.controlsContainer;

      controlsContainer.appendChild(this.createButton(this.labels.water, '', () => {
        this.runAction(() => {
          this.gameState.baseLiquid = 'water';
          return this.pourLiquid('water', this.brewSettings.water, BASE_LIQUID_HEIGHT);
        }, () => this.goToNextStep());
      }));

      controlsContainer.appendChild(this.createButton(this.labels.milk, 'jp-bg__btn--ghost', () => {
        this.runAction(() => {
          this.gameState.baseLiquid = 'milk';
          return this.pourLiquid('milk', this.brewSettings.milk, BASE_LIQUID_HEIGHT);
        }, () => this.goToNextStep());
      }));
    }

    renderCoffeeStep() {
      this.dialogElements.controlsContainer.appendChild(
        this.createButton(this.labels.coffee, '', () => {
          this.runAction(() => {
            if (!this.gameState.baseLiquid) {
              this.gameState.baseLiquid = 'water';
            }

            return this.addCoffee(COFFEE_LAYER_HEIGHT);
          }, () => this.goToNextStep());
        })
      );
    }

    renderSugarStep() {
      const controlsContainer = this.dialogElements.controlsContainer;
      const sugarCounter = document.createElement('span');
      sugarCounter.className = 'jp-bg__count';
      sugarCounter.textContent = fillCounterLabel(this.labels.sugarCounter, 0, MAX_SUGAR_CUBES);

      const skipButton = this.createButton(this.labels.skip, 'jp-bg__btn--ghost', () => {
        this.goToNextStep();
      });

      const addSugarButton = this.createButton(this.labels.sugar, '', () => {
        if (this.gameState.sugarCount >= MAX_SUGAR_CUBES) {
          return;
        }

        this.runAction(() => {
          this.gameState.sugarCount++;
          return this.addSugar();
        }, () => {
          sugarCounter.textContent = fillCounterLabel(
            this.labels.sugarCounter,
            this.gameState.sugarCount,
            MAX_SUGAR_CUBES
          );
          skipButton.textContent = this.labels.next;

          if (this.gameState.sugarCount >= MAX_SUGAR_CUBES) {
            addSugarButton.disabled = true;
          }
        });
      });

      controlsContainer.appendChild(addSugarButton);
      controlsContainer.appendChild(skipButton);
      controlsContainer.appendChild(sugarCounter);
    }

    renderStirStep() {
      /* Nothing was poured yet (the base step was removed): start with hot water. */
      if (!this.gameState.layers.length) {
        this.gameState.baseLiquid = 'water';
        this.gameState.layers.push({ color: this.brewSettings.water, height: BASE_LIQUID_HEIGHT });
        this.drawDrink();
      }

      this.dialogElements.controlsContainer.appendChild(
        this.createButton(this.labels.stir, '', () => {
          this.runAction(() => this.stirDrink(), () => this.goToNextStep());
        })
      );
    }

    showStep() {
      const dialogElements = this.dialogElements;
      const currentStep = this.steps[this.gameState.stepIndex];

      this.renderProgressDots(this.gameState.stepIndex);
      dialogElements.stepLabel.textContent = fillCounterLabel(
        this.labels.stepCounter,
        this.gameState.stepIndex + 1,
        this.steps.length
      );
      dialogElements.stepTitle.textContent = currentStep.title;
      dialogElements.stepText.textContent = currentStep.text;
      dialogElements.controlsContainer.replaceChildren();

      if (currentStep.action === 'cup') {
        this.renderCupStep();
      } else if (currentStep.action === 'base') {
        this.renderBaseStep();
      } else if (currentStep.action === 'coffee') {
        this.renderCoffeeStep();
      } else if (currentStep.action === 'sugar') {
        this.renderSugarStep();
      } else if (currentStep.action === 'stir') {
        this.renderStirStep();
      }
    }

    /* ---------- open / close ---------- */

    stopAnimations() {
      this.animationSessionId++;
      this.isBusy = false;
      this.isStreamPouring = false;
    }

    openGuide() {
      /* no step blocks yet: nothing to show */
      if (!this.steps.length) {
        return;
      }

      this.resetGame();

      if (typeof this.brewDialog.showModal === 'function') {
        if (!this.brewDialog.open) {
          this.brewDialog.showModal();
        }
      } else {
        this.brewDialog.setAttribute('open', '');
      }
    }

    closeGuide() {
      this.stopAnimations();

      if (typeof this.brewDialog.close === 'function') {
        this.brewDialog.close();
      } else {
        this.brewDialog.removeAttribute('open');
      }
    }

    /* 3D tilt of the cup following the pointer */
    tiltCup(event) {
      if (this.motionScale < 1) {
        return;
      }

      const stageRect = this.dialogElements.stage.getBoundingClientRect();
      const pointerOffsetX = (event.clientX - stageRect.left) / stageRect.width - 0.5;
      const pointerOffsetY = (event.clientY - stageRect.top) / stageRect.height - 0.5;
      const rotateYDegrees = pointerOffsetX * CUP_TILT_Y_DEGREES;
      const rotateXDegrees = -pointerOffsetY * CUP_TILT_X_DEGREES;
      this.dialogElements.cupWrap.style.transform =
        'rotateY(' + rotateYDegrees + 'deg) rotateX(' + rotateXDegrees + 'deg)';
    }

    bindEvents() {
      const brewDialog = this.brewDialog;

      const onOpenClick = (event) => {
        /* stop listening when the section was re-rendered (theme editor) */
        if (!brewDialog.isConnected) {
          document.removeEventListener('click', onOpenClick);
          return;
        }

        const openTrigger = event.target.closest && event.target.closest('[data-jp-brew-open]');

        if (openTrigger) {
          event.preventDefault();
          this.openGuide();
        }
      };

      document.addEventListener('click', onOpenClick);
      this.queryInDialog('[data-jp-brew-close]').addEventListener('click', () => {
        this.closeGuide();
      });

      this.queryInDialog('[data-jp-brew-restart]').addEventListener('click', () => {
        if (!this.isBusy) {
          this.resetGame();
        }
      });

      /* A click on the backdrop lands on the dialog itself. */
      brewDialog.addEventListener('click', (event) => {
        if (event.target === brewDialog) {
          this.closeGuide();
        }
      });

      /* Esc closes the dialog without going through closeGuide(): stop any running animation too */
      brewDialog.addEventListener('close', () => {
        this.stopAnimations();
      });

      this.dialogElements.stage.addEventListener('pointermove', (event) => {
        this.tiltCup(event);
      });

      this.dialogElements.stage.addEventListener('pointerleave', () => {
        this.dialogElements.cupWrap.style.transform = '';
      });
    }
  }

  /* ---------- 4. start ---------- */

  function initBrewGuide(brewDialog) {
    if (brewDialog.dataset.jpBrewReady) {
      return;
    }

    brewDialog.dataset.jpBrewReady = 'true';

    const brewSettings = readBrewSettings(brewDialog);

    if (!brewSettings) {
      return;
    }

    new BrewGuide(brewDialog, brewSettings);
  }

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
