(() => {
  "use strict";
    // R003.2 - events.js, which is the event binding and handling logic for the runtime, PRETTY much a direct copy 
  const dpek = window.__DPEK__ || {};

  function bindRuntimeEvents(controller) {
    if (!controller) {
      return;
    }

    const { state, overlay, fields, eventMatchesAnyBinding } = controller;

    function isSupportedTarget(target) {
      return !!target && fields.isSupportedField(target);
    }

    function clearTarget() {
      state.target = null;
      overlay.hide();
    }

    function setActiveTarget(target) {
      state.target = target;
      state.lastToken = "";
      controller.updateSuggestions();
    }

    function onFocusIn(event) {
      if (!isSupportedTarget(event.target)) {
        clearTarget();
        return;
      }

      setActiveTarget(event.target);
    }

    function onInput(event) {
      if (state.target !== event.target) return;
      controller.updateSuggestions();
    }

    function onSelectionChange() {
      if (state.target && document.activeElement === state.target) {
        controller.positionOverlay();
      }
    }

    function onKeyDown(event) {
      if (state.target !== event.target) return;

      if (eventMatchesAnyBinding(event, controller.runtimeConfig.keyBindings.dismiss)) {
        event.preventDefault();
        overlay.hide();
        return;
      }

      if (!overlay.isVisible() || state.suggestions.length === 0) return;

      if (eventMatchesAnyBinding(event, controller.runtimeConfig.keyBindings.next)) {
        event.preventDefault();
        controller.cycle(1);
        return;
      }

      if (eventMatchesAnyBinding(event, controller.runtimeConfig.keyBindings.previous)) {
        event.preventDefault();
        controller.cycle(-1);
        return;
      }

      if (eventMatchesAnyBinding(event, controller.runtimeConfig.keyBindings.accept)) {
        event.preventDefault();
        controller.applyCompletion();
      }
    }

    const eventConfig = [
      ["focusin", onFocusIn, true],
      ["input", onInput, true],
      ["click", onInput, true],
      ["keydown", onKeyDown, true],
      ["selectionchange", onSelectionChange, true]
    ];

    eventConfig.forEach(([eventName, handler, capture]) => {
      document.addEventListener(eventName, handler, capture);
    });

    window.addEventListener("scroll", controller.positionOverlay, true);
    window.addEventListener("resize", controller.positionOverlay);
  }

  window.__DPEK__ = window.__DPEK__ || {};
  window.__DPEK__.bindRuntimeEvents = bindRuntimeEvents;
})();