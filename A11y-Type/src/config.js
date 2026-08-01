(() => {
    "use strict";
    const config = {
        tokenPattern: /[\p{L}+'’]+$/u,
        maxSuggestions: 4,
        dictionarySets: {
            general: [
                "dictionaries/dictionary-en.txt",
                "dictionaries/dictionary-en-uk-contractions-diacritics.txt"
            ]
        },
        hostDictionaryRules: [],
        defaultDictionarySet: "general",
        commonRankFile: "dictionaries/common-words-rank.txt",
        correctionsFile: "dictionaries/compounds-auto-en-uk.txt"
    };
    const SETTINGS_STORAGE_KEY = "dpekSettings";
    const ADVANCED_SETTINGS_STORAGE_KEY = "dpekAdvancedSettings";
    const defaultSettings = {
        maxSuggestions: 4,
        overlay: {
            minWidth: 220,
            maxWidth: 320,
            borderRadius: 4,
            fontSize: 12,
            backgroundColor: "#252526",
            textColor: "#cccccc",
            borderColor: "#454545",
            hintColor: "#9cdcfe",
            activeBackgroundColor: "#04395e",
            activeTextColor: "#ffffff",
            activeHintColor: "#c5e4ff"
        },
        keyBindings: {
            accept: ["Tab"],
            next: ["ArrowDown"],
            previous: ["ArrowUp"],
            dismiss: ["Escape"]
        }
    };

    const defaultAdvancedSettings = {
        customDictionaries: [],
        hostDictionaryRules: []
    };

    const KEY_NAME_MAP = new Map([
        ["esc", "Escape"],
        ["space", "Space"],
        ["spacebar", "Space"],
        ["up", "ArrowUp"],
        ["down", "ArrowDown"],
        ["left", "ArrowLeft"],
        ["right", "ArrowRight"],
        ["return", "Enter"]
    ]);

    const MODIFIER_MAP = {
        "ctrl": "Ctrl", "control": "Ctrl",
        "alt": "Alt",
        "shift": "Shift",
        "meta": "Meta", "cmd": "Meta", "command": "Meta", "win": "Meta"
    };

    // Overlay color properties that need sanitization
    const OVERLAY_COLOR_KEYS = [
        "backgroundColor",
        "textColor",
        "borderColor",
        "hintColor",
        "activeBackgroundColor",
        "activeTextColor",
        "activeHintColor"
    ];

    function resolveRuntimeConfig(storedSettings, advancedSettings) {
        const settings = sanitizeSettings(storedSettings);
        const advanced = sanitizeAdvancedSettings(advancedSettings);

        return {
            ...config,
            maxSuggestions: settings.maxSuggestions,
            overlay: settings.overlay,
            keyBindings: settings.keyBindings,
            customDictionaries: advanced.customDictionaries,
            hostDictionaryRules: advanced.hostDictionaryRules
        };
    }

    function sanitizeAdvancedSettings(input) {
        const { customDictionaries = [], hostDictionaryRules = [] } = input ?? {};

        const normalizedDictionaries = customDictionaries
            .map(sanitizeCustomDictionary)
            .filter(Boolean);

        const normalizedRules = hostDictionaryRules
            .map((entry) => sanitizeHostRule(entry, normalizedDictionaries))
            .filter(Boolean);

        return {
            customDictionaries: normalizedDictionaries,
            hostDictionaryRules: normalizedRules
        };
    }

    function sanitizeCustomDictionary(entry) {
        if (!entry || typeof entry !== "object") return null;

        const id = String(entry.id ?? "").trim();
        const name = String(entry.name ?? "").trim();
        const content = String(entry.content ?? "").trim();

        return (id && name && content) ? { id, name, content } : null;
    }

    function sanitizeHostRule(entry, normalizedDictionaries) {
        if (!entry || typeof entry !== "object") return null;

        const hostPattern = String(entry.hostPattern ?? "").trim().toLowerCase();
        const set = String(entry.set ?? "").trim();

        if (!hostPattern || !set) return null;

        const isBuiltInSet = set in config.dictionarySets;
        const isCustomSet = set.startsWith("custom:") &&
            normalizedDictionaries.some((dict) => `custom:${dict.id}` === set);

        return (isBuiltInSet || isCustomSet) ? { hostPattern, set } : null;
    }

    function sanitizeSettings(input) {
        const { overlay = {}, keyBindings = {}, maxSuggestions } = input ?? {};

        const minWidth = clampInt(overlay.minWidth, 160, 600, defaultSettings.overlay.minWidth);
        const rawMaxWidth = clampInt(overlay.maxWidth, 180, 720, defaultSettings.overlay.maxWidth);
        const maxWidth = Math.max(minWidth, rawMaxWidth);

        const overlayDefaults = defaultSettings.overlay;
        const overlayColors = {};
        for (const key of OVERLAY_COLOR_KEYS) {
            overlayColors[key] = sanitizeColor(overlay[key], overlayDefaults[key]);
        }

        const bindingDefaults = defaultSettings.keyBindings;
        const normalizedBindings = {
            accept: sanitizeBindingList(keyBindings.accept, bindingDefaults.accept),
            next: sanitizeBindingList(keyBindings.next, bindingDefaults.next),
            previous: sanitizeBindingList(keyBindings.previous, bindingDefaults.previous),
            dismiss: sanitizeBindingList(keyBindings.dismiss, bindingDefaults.dismiss)
        };

        return {
            maxSuggestions: clampInt(maxSuggestions, 1, 12, defaultSettings.maxSuggestions),
            overlay: {
                minWidth,
                maxWidth,
                borderRadius: clampInt(overlay.borderRadius, 0, 24, overlayDefaults.borderRadius),
                fontSize: clampInt(overlay.fontSize, 10, 22, overlayDefaults.fontSize),
                ...overlayColors
            },
            keyBindings: normalizedBindings
        };
    }

    function clampInt(value, min, max, fallback) {
        const numeric = Number.parseInt(value, 10);
        return Number.isFinite(numeric) ? Math.max(min, Math.min(max, numeric)) : fallback;
    }

    function sanitizeColor(value, fallback) {
        if (typeof value !== "string") return fallback;

        const trimmed = value.trim();
        return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed) ? trimmed : fallback;
    }

    function sanitizeBindingList(value, fallbackList) {
        const list = Array.isArray(value) ? value : [value];
        const normalized = list
            .map(normalizeBindingString)
            .filter(Boolean);

        return normalized.length > 0 ? normalized : fallbackList.slice();
    }

    function normalizeBindingString(value) {
        if (typeof value !== "string") return "";

        const parts = value.split("+").map((p) => p.trim()).filter(Boolean);
        if (parts.length === 0) return "";

        const modifiers = [];
        let key = "";

        for (const part of parts) {
            const lower = part.toLowerCase();
            const modifier = MODIFIER_MAP[lower];

            if (modifier) {
                if (!modifiers.includes(modifier)) modifiers.push(modifier);
            } else {
                key = normalizeKeyName(part);
            }
        }

        return key ? (modifiers.length > 0 ? `${modifiers.join("+")}+${key}` : key) : "";
    }

    function normalizeKeyName(value) {
        const lower = value.toLowerCase();
        const mapped = KEY_NAME_MAP.get(lower);

        if (mapped) return mapped;
        if (lower.length === 1) return lower.toUpperCase();

        return value.length > 0 ? value[0].toUpperCase() + value.slice(1) : "";
    }

    function eventMatchesBinding(event, binding) {
        if (typeof binding !== "string" || !binding) return false;

        const parsed = parseBinding(binding);
        if (!parsed) return false;

        const eventKey = normalizeEventKey(event.key);
        return eventKey === parsed.key &&
            event.ctrlKey === parsed.ctrl &&
            event.altKey === parsed.alt &&
            event.shiftKey === parsed.shift &&
            event.metaKey === parsed.meta;
    }

    function eventMatchesAnyBinding(event, bindings) {
        const list = Array.isArray(bindings) ? bindings : [bindings];
        return list.some((binding) => eventMatchesBinding(event, binding));
    }

    function parseBinding(binding) {
        const parts = binding.split("+").map((p) => p.trim()).filter(Boolean);
        if (parts.length === 0) return null;

        const parsed = { ctrl: false, alt: false, shift: false, meta: false, key: "" };

        for (const part of parts) {
            if (part === "Ctrl") parsed.ctrl = true;
            else if (part === "Alt") parsed.alt = true;
            else if (part === "Shift") parsed.shift = true;
            else if (part === "Meta") parsed.meta = true;
            else parsed.key = normalizeEventKey(part);
        }

        return parsed.key ? parsed : null;
    }

    function normalizeEventKey(value) {
        if (typeof value !== "string" || !value) return "";
        if (value === " ") return "Space";

        const mapped = normalizeKeyName(value);
        return mapped.length === 1 ? mapped.toUpperCase() : mapped;
    }

    window.__DPEK__ = window.__DPEK__ || {};
    window.__DPEK__.config = config;
    window.__DPEK__.defaultSettings = defaultSettings;
    window.__DPEK__.defaultAdvancedSettings = defaultAdvancedSettings;
    window.__DPEK__.resolveRuntimeConfig = resolveRuntimeConfig;
    window.__DPEK__.eventMatchesAnyBinding = eventMatchesAnyBinding;
    window.__DPEK__.normalizeBindingString = normalizeBindingString;
    window.__DPEK__.normalizeEventKey = normalizeEventKey;
    window.__DPEK__.SETTINGS_STORAGE_KEY = SETTINGS_STORAGE_KEY;
    window.__DPEK__.ADVANCED_SETTINGS_STORAGE_KEY = ADVANCED_SETTINGS_STORAGE_KEY;
})();