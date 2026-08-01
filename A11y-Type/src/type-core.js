  /*
  Type Core is is the core logic for A11Y Type. 
  It monitors the user input, suggestions corrections and completions, allows the user to select a suggestion and applies it to the input field. 
  Manages that displays the suggestions. 
  It is a bit of a mess but prototype and is functional
  */
  
  (() => {
"use strict";
  
  if (window.__DPEK_EXTENSION_INSTALLED__) {
    return;
  }
  window.__DPEK_EXTENSION_INSTALLED__ = true;

  const dpek = window.__DPEK__ || {};
  const config = dpek.config;
  const fields = dpek.fields;
  const resolveRuntimeConfig = dpek.resolveRuntimeConfig;
  const eventMatchesAnyBinding = dpek.eventMatchesAnyBinding;
  const settingsStorageKey = dpek.SETTINGS_STORAGE_KEY;
  const advancedSettingsStorageKey = dpek.ADVANCED_SETTINGS_STORAGE_KEY;

  const required = [config, fields, resolveRuntimeConfig, eventMatchesAnyBinding,
                    dpek.createState, dpek.createOverlay, dpek.createDictionaryManager];
  if (required.some((x) => !x)) return;

  let runtimeConfig = resolveRuntimeConfig(null);
  const state = dpek.createState();
  const overlay = dpek.createOverlay(runtimeConfig.overlay);
  const dictionaryManager = dpek.createDictionaryManager(config, state);

  initialize();

  const eventConfig = [
    ["focusin", onFocusIn, true],
    ["input", onInput, true],
    ["click", onInput, true],
    ["keydown", onKeyDown, true],
    ["selectionchange", onSelectionChange, true]
  ];
  eventConfig.forEach(([evt, handler, capture]) => {
    document.addEventListener(evt, handler, capture);
  });
  window.addEventListener("scroll", positionOverlay, true);
  window.addEventListener("resize", positionOverlay);

  async function initialize() {
    await refreshRuntimeConfig();
    await dictionaryManager.initialize();
    updateSuggestions();

    if (chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (!["sync", "local"].includes(areaName)) return;
        if (!changes[settingsStorageKey] && !changes[advancedSettingsStorageKey]) return;

        refreshRuntimeConfig().then(() => updateSuggestions());
      });
    }
  }

  async function refreshRuntimeConfig() {
    const [stored, advancedStored] = await Promise.all([
      chromeStorageGet(settingsStorageKey, "sync"),
      chromeStorageGet(advancedSettingsStorageKey, "local")
    ]);
    runtimeConfig = resolveRuntimeConfig(stored, advancedStored);
    overlay.applySettings(runtimeConfig.overlay);
  }

  function chromeStorageGet(key, area) {
    if (!chrome.storage?.[area === "local" ? "local" : "sync"]) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      chrome.storage[area === "local" ? "local" : "sync"].get([key], (result) => {
        resolve(chrome.runtime?.lastError ? null : result?.[key] ?? null);
      });
    });
  }

  function onFocusIn(event) {
    if (!fields.isSupportedField(event.target)) {
      state.target = null;
      overlay.hide();
      return;
    }

    state.target = event.target;
    state.lastToken = "";
    updateSuggestions();
  }

  function onInput(event) {
    if (state.target !== event.target) return;
    updateSuggestions();
  }

  function onSelectionChange() {
    if (state.target && document.activeElement === state.target) {
      positionOverlay();
    }
  }

  function onKeyDown(event) {
    if (state.target !== event.target) return;

    if (eventMatchesAnyBinding(event, runtimeConfig.keyBindings.dismiss)) {
      event.preventDefault();
      overlay.hide();
      return;
    }

    if (state.suggestions.length === 0) return;

    if (eventMatchesAnyBinding(event, runtimeConfig.keyBindings.next)) {
      event.preventDefault();
      cycle(1);
      return;
    }

    if (eventMatchesAnyBinding(event, runtimeConfig.keyBindings.previous)) {
      event.preventDefault();
      cycle(-1);
      return;
    }

    if (eventMatchesAnyBinding(event, runtimeConfig.keyBindings.accept)) {
      event.preventDefault();
      applyCompletion();
    }
  }

  function updateSuggestions() {
    if (!state.target || !fields.isSupportedField(state.target)) {
      overlay.hide();
      return;
    }

    const context = fields.getContext(state.target, config.tokenPattern);
    if (!context) {
      overlay.hide();
      return;
    }

    const rawToken = context.token;
    const lookupToken = window.__DPEK__.normalizeLookupToken(rawToken);

    if (lookupToken !== state.lastToken) {
      state.activeIndex = 0;
      state.lastToken = lookupToken;
      state.suggestionCache = { lastPrefix: "", lastResults: [] };
    }

    if (lookupToken.length === 0) {
      state.suggestions = [];
      overlay.hide();
      return;
    }

    state.suggestions = dictionaryManager.getSuggestions(lookupToken, runtimeConfig.maxSuggestions)
      .map((word) => {
        const cased = applyUserCase(word, rawToken);
        return {
          label: cased,
          nextKey: word.charAt(lookupToken.length) || "space"
        };
      });

    if (state.suggestions.length === 0) {
      overlay.hide();
      return;
    }

    state.activeIndex = Math.min(state.activeIndex, state.suggestions.length - 1);
    overlay.render(state.suggestions, state.activeIndex);
    positionOverlay();
  }

  function applyUserCase(word, userInput) {
    if (userInput.length === 0) return word;

    const uppercaseCount = (userInput.match(/[A-Z]/g) || []).length;

    if (uppercaseCount >= 2) {
      return word.toUpperCase();
    }

    if (uppercaseCount === 1) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }

    return word.toLowerCase();
  }

  function cycle(direction) {
    const n = state.suggestions.length;
    state.activeIndex = (state.activeIndex + direction + n) % n;
    overlay.render(state.suggestions, state.activeIndex);
    positionOverlay();
  }

  function applyCompletion() {
    if (!state.target) return;

    const active = state.suggestions[state.activeIndex];
    if (!active) return;

    const changed = fields.applyCompletion(state.target, active.label, config.tokenPattern);
    if (changed) updateSuggestions();
  }

  function positionOverlay() {
    if (!state.target || state.suggestions.length === 0) return;

    const targetRect = state.target.getBoundingClientRect();
    const caret = fields.getCaretCoordinates(state.target);
    overlay.position(targetRect, caret);
  }
})();