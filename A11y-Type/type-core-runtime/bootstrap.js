(() => {
    "use strict";
    // R003.1 - bootstrap from type-core.js plus some quality of life fixes.
    // So this is now the actual runtime entrypoint for V1.2 modular setup
    // Means I do not need type-core.js being loaded at same time and fighting it
    // Making public version align with private tested version 
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

    const required = [
        config,
        fields,
        resolveRuntimeConfig,
        eventMatchesAnyBinding,
        dpek.createState,
        dpek.createOverlay,
        dpek.createDictionaryManager,
        dpek.createSuggestionController,
        dpek.bindRuntimeEvents
    ];

    if (required.some((value) => !value)) {
        return;
    }

    function createRuntimeController() {
        let runtimeConfig = resolveRuntimeConfig(null);
        const state = dpek.createState();
        const overlay = dpek.createOverlay(runtimeConfig.overlay);

        const controller = {
            config,
            fields,
            eventMatchesAnyBinding,
            settingsStorageKey,
            advancedSettingsStorageKey,
            runtimeConfig,
            state,
            overlay,
            dictionaryManager: null,
            initialize,
            refreshRuntimeConfig,
            chromeStorageGet
        };

        // Using getter here so dictionary manager always reads the live merged config
        // otherwise custom dictionaries / host rules just sit in storage and never actually get used which was an issue in the OG type-core.js
        controller.dictionaryManager = dpek.createDictionaryManager(() => controller.runtimeConfig, state);

        async function initialize() {
            await refreshRuntimeConfig();
            await controller.dictionaryManager.initialize();
            controller.updateSuggestions();

            if (chrome.storage?.onChanged) {
                chrome.storage.onChanged.addListener(async (changes, areaName) => {
                    if (!["sync", "local"].includes(areaName)) return;

                    const settingsChanged = Boolean(changes[settingsStorageKey]);
                    const advancedChanged = Boolean(changes[advancedSettingsStorageKey]);

                    if (!settingsChanged && !advancedChanged) return;

                    await refreshRuntimeConfig();

                    // Overlay settings can just repaint but dictionary changes need an actual reload
                    // otherwise user saves advanced settings and thinks it worked when it did not, which is funnnn.
                    if (advancedChanged) {
                        await controller.dictionaryManager.reloadDictionaries();
                        state.lastToken = "";
                    }

                    controller.updateSuggestions();
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
            controller.runtimeConfig = runtimeConfig;
        }

        function chromeStorageGet(key, area) {
            const storageArea = area === "local" ? chrome.storage?.local : chrome.storage?.sync;
            if (!storageArea) {
                return Promise.resolve(null);
            }

            return new Promise((resolve) => {
                storageArea.get([key], (result) => {
                    resolve(chrome.runtime?.lastError ? null : result?.[key] ?? null);
                });
            });
        }

        return controller;
    }

    const controller = createRuntimeController();

    // Suggestions wire first so event handlers are calling real controller methods
    dpek.createSuggestionController(controller);
    dpek.bindRuntimeEvents(controller);
    controller.initialize();

    window.__DPEK__ = window.__DPEK__ || {};
    window.__DPEK__.createRuntimeController = createRuntimeController;
})();