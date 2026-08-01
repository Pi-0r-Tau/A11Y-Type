(() => {
    "use strict";

    function bindEvent(element, eventName, handler) {
        if (!element) {
            return;
        }

        element.addEventListener(eventName, handler);
    }

    function buildSettingsPayload(elements) {
        return {
            maxSuggestions: toInt(elements.maxSuggestions.value),
            overlay: {
                minWidth: toInt(elements.minWidth.value),
                maxWidth: toInt(elements.maxWidth.value),
                borderRadius: toInt(elements.borderRadius.value),
                fontSize: toInt(elements.fontSize.value),
                ...readOverlayFromForm(elements)
            },
            keyBindings: readKeyBindingsFromForm(elements)
        };
    }

    // Array format expected by the runtime config.
    function readKeyBindingsFromForm(elements) {
        return {
            accept: toBindingArray(elements.acceptKeys.value),
            next: toBindingArray(elements.nextKeys.value),
            previous: toBindingArray(elements.previousKeys.value),
            dismiss: toBindingArray(elements.dismissKeys.value)
        };
    }

    function readOverlayFromForm(elements) {
        return {
            backgroundColor: elements.backgroundColor.value,
            textColor: elements.textColor.value,
            borderColor: elements.borderColor.value,
            hintColor: elements.hintColor.value,
            activeBackgroundColor: elements.activeBackgroundColor.value,
            activeTextColor: elements.activeTextColor.value,
            activeHintColor: elements.activeHintColor.value
        };
    }

    // Array form used by the settings model.
    function toBindingArray(value) {
        const single = String(value || "").trim();
        return single.length > 0 ? [single] : [];
    }

    function firstBinding(value) {
        if (!Array.isArray(value) || value.length === 0) {
            return "";
        }
        return value[0];
    }

    function toInt(value) {
        return Number.parseInt(value, 10);
    }

    window.__DPEK__ = window.__DPEK__ || {};
    window.__DPEK__.optionsBindings = {
        bindEvent,
        buildSettingsPayload,
        readKeyBindingsFromForm,
        readOverlayFromForm,
        toBindingArray,
        firstBinding,
        toInt
    };
})();
