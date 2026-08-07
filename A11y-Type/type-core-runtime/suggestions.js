(() => {
    "use strict";

    // R003.3 - suggestions.js, which is the suggestion controller logic for the runtime
    // have rennamed from controller as think it detracts from the bootstrap and event binding files which are more of a controller
    // Couple of bug fixes but nothing major, yet...not yet anyway

    const dpek = window.__DPEK__ || {};

    function createSuggestionController(controller) {
        if (!controller) {
            return;
        }

        const { state, overlay, fields, config, dictionaryManager } = controller;

        function updateSuggestions() {
            if (!state.target || !fields.isSupportedField(state.target)) {
                state.suggestions = [];
                overlay.hide();
                return;
            }

            const context = fields.getContext(state.target, config.tokenPattern);
            if (!context) {
                state.suggestions = [];
                overlay.hide();
                return;
            }

            const rawToken = context.token;
            const lookupToken = window.__DPEK__.normalizeLookupToken(rawToken);

            if (lookupToken !== state.lastToken) {
                state.activeIndex = 0;
                state.lastToken = lookupToken;
            }

            if (lookupToken.length === 0) {
                state.suggestions = [];
                overlay.hide();
                return;
            }

            state.suggestions = dictionaryManager
                .getSuggestions(lookupToken, controller.runtimeConfig.maxSuggestions)
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

        // Was prev bug where user case was not applied to suggestions
        // So if user types WONDER it should not suggest wonder and look a bit broken / jarring
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
            const count = state.suggestions.length;
            state.activeIndex = (state.activeIndex + direction + count) % count;
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
            overlay.position(targetRect, caret, state.target);
        }

        controller.updateSuggestions = updateSuggestions;
        controller.applyUserCase = applyUserCase;
        controller.cycle = cycle;
        controller.applyCompletion = applyCompletion;
        controller.positionOverlay = positionOverlay;
    }

    window.__DPEK__ = window.__DPEK__ || {};
    window.__DPEK__.createSuggestionController = createSuggestionController;
})();