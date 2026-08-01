(() => {
    "use strict";

    const dpek = window.__DPEK__ || {};
    const settingsStorageKey = dpek.SETTINGS_STORAGE_KEY;
    const resolveRuntimeConfig = dpek.resolveRuntimeConfig;
    const normalizeBindingString = dpek.normalizeBindingString;
    const optionsBindings = dpek.optionsBindings;

    if (!settingsStorageKey || !resolveRuntimeConfig || !normalizeBindingString || !optionsBindings) {
        return;
    }

    const COLOR_KEYS = [
        "backgroundColor",
        "textColor",
        "borderColor",
        "hintColor",
        "activeBackgroundColor",
        "activeTextColor",
        "activeHintColor"
    ];

    const PALETTES = {
        custom: null,
        protanopia: {
            backgroundColor: "#1f2328",
            textColor: "#f0f3f6",
            borderColor: "#73808c",
            hintColor: "#67d3ff",
            activeBackgroundColor: "#005a9c",
            activeTextColor: "#ffffff",
            activeHintColor: "#e7f6ff"
        },
        deuteranopia: {
            backgroundColor: "#1c1f24",
            textColor: "#f4f4f4",
            borderColor: "#7c8088",
            hintColor: "#6cd4ff",
            activeBackgroundColor: "#9b4f00",
            activeTextColor: "#ffffff",
            activeHintColor: "#fff1df"
        },
        tritanopia: {
            backgroundColor: "#202124",
            textColor: "#f2f2f2",
            borderColor: "#797d86",
            hintColor: "#5ad7c7",
            activeBackgroundColor: "#8b3f00",
            activeTextColor: "#ffffff",
            activeHintColor: "#ffe9d5"
        },
        highContrast: {
            backgroundColor: "#000000",
            textColor: "#ffffff",
            borderColor: "#ffffff",
            hintColor: "#00ffff",
            activeBackgroundColor: "#ffffff",
            activeTextColor: "#000000",
            activeHintColor: "#003333"
        }
    };

    const ids = {
        maxSuggestions: "maxSuggestions",
        minWidth: "minWidth",
        maxWidth: "maxWidth",
        borderRadius: "borderRadius",
        fontSize: "fontSize",
        backgroundColor: "backgroundColor",
        textColor: "textColor",
        borderColor: "borderColor",
        hintColor: "hintColor",
        activeBackgroundColor: "activeBackgroundColor",
        activeTextColor: "activeTextColor",
        activeHintColor: "activeHintColor",
        colorPreset: "colorPreset",
        presetPreview: "presetPreview",
        acceptKeys: "acceptKeys",
        nextKeys: "nextKeys",
        previousKeys: "previousKeys",
        dismissKeys: "dismissKeys",
        captureHint: "captureHint",
        saveButton: "saveButton",
        resetButton: "resetButton",
        status: "status"
    };

    const elements = Object.fromEntries(
        Object.entries(ids).map(([key, id]) => [key, document.getElementById(id)])
    );

    const keyCaptureInputs = [
        elements.acceptKeys,
        elements.nextKeys,
        elements.previousKeys,
        elements.dismissKeys
    ];

    attachEventListeners();
    loadSettings();

    function attachEventListeners() {
        optionsBindings.bindEvent(elements.saveButton, "click", onSave);
        optionsBindings.bindEvent(elements.resetButton, "click", onReset);
        optionsBindings.bindEvent(elements.colorPreset, "change", onColorPresetChange);

        for (const input of keyCaptureInputs) {
            optionsBindings.bindEvent(input, "keydown", onKeyCaptureDown);
            optionsBindings.bindEvent(input, "focus", onKeyCaptureFocus);
            optionsBindings.bindEvent(input, "blur", onKeyCaptureBlur);
        }

        for (const colorKey of COLOR_KEYS) {
            optionsBindings.bindEvent(elements[colorKey], "input", onCustomColorChanged);
        }
    }

    function loadSettings() {
        chrome.storage.sync.get([settingsStorageKey], (result) => {
            const raw = result ? result[settingsStorageKey] : null;
            const runtime = resolveRuntimeConfig(raw);
            fillForm(runtime);
            setStatus("Loaded", false);
        });
    }

    function fillForm(runtime) {
        elements.maxSuggestions.value = runtime.maxSuggestions;
        elements.minWidth.value = runtime.overlay.minWidth;
        elements.maxWidth.value = runtime.overlay.maxWidth;
        elements.borderRadius.value = runtime.overlay.borderRadius;
        elements.fontSize.value = runtime.overlay.fontSize;

        elements.backgroundColor.value = runtime.overlay.backgroundColor;
        elements.textColor.value = runtime.overlay.textColor;
        elements.borderColor.value = runtime.overlay.borderColor;
        elements.hintColor.value = runtime.overlay.hintColor;
        elements.activeBackgroundColor.value = runtime.overlay.activeBackgroundColor;
        elements.activeTextColor.value = runtime.overlay.activeTextColor;
        elements.activeHintColor.value = runtime.overlay.activeHintColor;

        elements.acceptKeys.value = optionsBindings.firstBinding(runtime.keyBindings.accept);
        elements.nextKeys.value = optionsBindings.firstBinding(runtime.keyBindings.next);
        elements.previousKeys.value = optionsBindings.firstBinding(runtime.keyBindings.previous);
        elements.dismissKeys.value = optionsBindings.firstBinding(runtime.keyBindings.dismiss);

        syncPresetFromOverlay(runtime.overlay);
    }

    function onSave() {
        const candidate = buildSettingsPayload();
        const runtime = resolveRuntimeConfig(candidate);
        const normalized = {
            maxSuggestions: runtime.maxSuggestions,
            overlay: runtime.overlay,
            keyBindings: runtime.keyBindings
        };

        chrome.storage.sync.set({ [settingsStorageKey]: normalized }, () => {
            if (chrome.runtime && chrome.runtime.lastError) {
                setStatus("Failed to save settings", true);
                return;
            }

            fillForm(runtime);
            setStatus("Saved", false);
        });
    }

    function buildSettingsPayload() {
        return optionsBindings.buildSettingsPayload(elements);
    }

    function onReset() {
        chrome.storage.sync.remove([settingsStorageKey], () => {
            if (chrome.runtime && chrome.runtime.lastError) {
                setStatus("Failed to reset settings", true);
                return;
            }

            const runtime = resolveRuntimeConfig(null);
            fillForm(runtime);
            setStatus("Defaults restored", false);
        });
    }

    function onColorPresetChange() {
        const presetName = elements.colorPreset.value;
        if (presetName === "custom") {
            renderPresetPreview(readOverlayFromForm());
            return;
        }

        const palette = PALETTES[presetName];
        if (!palette) {
            return;
        }

        for (const colorKey of COLOR_KEYS) {
            elements[colorKey].value = palette[colorKey];
        }

        renderPresetPreview(palette);
        setStatus(`Applied ${elements.colorPreset.options[elements.colorPreset.selectedIndex].text}`, false);
    }

    function onCustomColorChanged() {
        elements.colorPreset.value = "custom";
        renderPresetPreview(readOverlayFromForm());
    }

    function onKeyCaptureDown(event) {
        event.preventDefault();

        if (event.key === "Backspace" || event.key === "Delete") {
            event.target.value = "";
            event.target.classList.remove("capturing");
            setCaptureHint("Binding cleared. Click again to capture another key.", false, false);
            setStatus("Binding cleared", false);
            return;
        }

        const binding = bindingFromEvent(event);
        if (!binding) {
            event.target.classList.add("capturing");
            setCaptureHint("Press any non-modifier key, optionally with Ctrl, Alt, Shift, or Meta.", true, true);
            setStatus("Press a non-modifier key", true);
            return;
        }

        event.target.value = binding;
        event.target.classList.remove("capturing");
        event.target.blur();
        setCaptureHint(`Captured ${binding}. Click any field to record a different key.`, false, false);
        setStatus(`Captured ${binding}`, false);
    }

    function onKeyCaptureFocus(event) {
        event.target.classList.add("capturing");
        setCaptureHint("Press any key now. The next keypress will be saved as this hotkey.", false, true);
    }

    function onKeyCaptureBlur(event) {
        event.target.classList.remove("capturing");
        if (!anyCaptureFieldFocused()) {
            setCaptureHint("Click a box and press the key combo you want, for example Ctrl+J, Tab, or Escape.", false, false);
        }
    }

    function anyCaptureFieldFocused() {
        return keyCaptureInputs.some((input) => document.activeElement === input);
    }

    function setCaptureHint(message, isError, isArmed) {
        if (!elements.captureHint) {
            return;
        }

        elements.captureHint.textContent = message;
        elements.captureHint.classList.toggle("armed", Boolean(isArmed) && !isError);
        elements.captureHint.style.color = isError ? "#f48771" : "";
    }

    function bindingFromEvent(event) {
        if (isModifierOnly(event.key)) {
            return "";
        }

        const modifiers = [];
        if (event.ctrlKey) modifiers.push("Ctrl");
        if (event.altKey) modifiers.push("Alt");
        if (event.shiftKey) modifiers.push("Shift");
        if (event.metaKey) modifiers.push("Meta");

        const keyPart = event.key === " " ? "Space" : event.key;
        const rawBinding = modifiers.length > 0 ? `${modifiers.join("+")}+${keyPart}` : keyPart;

        return normalizeBindingString(rawBinding);
    }

    function isModifierOnly(key) {
        const lower = String(key || "").toLowerCase();
        return lower === "control" || lower === "shift" || lower === "alt" || lower === "meta";
    }

    function syncPresetFromOverlay(overlay) {
        const paletteName = findMatchingPalette(overlay);
        elements.colorPreset.value = paletteName;
        renderPresetPreview(overlay);
    }

    function findMatchingPalette(overlay) {
        for (const [name, palette] of Object.entries(PALETTES)) {
            if (name === "custom" || !palette) {
                continue;
            }

            let allMatch = true;
            for (const colorKey of COLOR_KEYS) {
                if (String(overlay[colorKey]).toLowerCase() !== String(palette[colorKey]).toLowerCase()) {
                    allMatch = false;
                    break;
                }
            }

            if (allMatch) {
                return name;
            }
        }

        return "custom";
    }

    function renderPresetPreview(overlay) {
        const colors = COLOR_KEYS.map((key) => overlay[key]);
        elements.presetPreview.innerHTML = colors
            .map((color) => `<span class="preset-chip" style="background:${color};"></span>`)
            .join("");
    }

    function setStatus(message, isError) {
        elements.status.textContent = message;
        elements.status.style.color = isError ? "#f48771" : "#4fc1ff";
    }
})();