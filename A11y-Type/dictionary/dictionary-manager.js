// R002.2
// Continuation of R002
// OG dictionary manager split to its own file to separate the mega amount of crap it did
(() => {
    "use strict";

    function createDictionaryManager(configSource, state) {
        return {
            async initialize() {
                const config = resolveConfig(configSource);
                await Promise.all([
                    loadCommonWordRanks(config, state),
                    loadActiveDictionaryWords(config, state),
                    loadCorrectionMap(config, state)
                ]);
            },

            async reloadDictionaries() {
                const config = resolveConfig(configSource);
                await loadActiveDictionaryWords(config, state);
            },

            getSuggestions(prefix, limit) {
                return window.__DPEK__.dictionaryRanker.getSuggestions(prefix, limit, state);
            }
        };
    }

    function resolveConfig(configSource) {
        return typeof configSource === "function" ? configSource() : configSource;
    }

    async function loadActiveDictionaryWords(config, state) {
        const merged = new Set();
        const loader = window.__DPEK__.dictionaryLoader;
        const ranker = window.__DPEK__.dictionaryRanker;

        const sources = await loader.resolveDictionarySources(config, window.location.hostname || "");
        for (const source of sources) {
            const expanded = loader.expandDictionaryEntries(source);
            for (const word of expanded) {
                merged.add(word);
            }
        }

        ranker.buildBuckets(Array.from(merged), state);
    }

    async function loadCommonWordRanks(config, state) {
        const loader = window.__DPEK__.dictionaryLoader;
        const rankWords = await loader.fetchWordFile(config.commonRankFile, false);

        if (rankWords.length === 0) {
            return;
        }

        const rankMap = new Map();

        for (let i = 0; i < rankWords.length; i++) {
            const normalized = loader.normalizeDictionaryToken(rankWords[i]);
            if (normalized && !rankMap.has(normalized)) {
                rankMap.set(normalized, i + 1);
            }
        }

        state.commonWordRanks = rankMap;
    }

    async function loadCorrectionMap(config, state) {
        if (!config.correctionsFile) {
            return;
        }

        try {
            const fileUrl = chrome.runtime.getURL(config.correctionsFile);
            const response = await fetch(fileUrl);
            if (!response.ok) {
                return;
            }

            const text = await response.text();
            const map = new Map();

            for (const line of text.split(/\r?\n/)) {
                const tab = line.indexOf("\t");
                if (tab === -1) {
                    continue;
                }

                const key = window.__DPEK__.dictionaryLoader.normalizeDictionaryToken(line.slice(0, tab));
                const preferred = line.slice(tab + 1).trim();

                if (key && preferred && !map.has(key)) {
                    map.set(key, preferred);
                }
            }

            state.correctionMap = map;
        } catch (_err) {

        }
    }

    window.__DPEK__ = window.__DPEK__ || {};
    window.__DPEK__.createDictionaryManager = createDictionaryManager;
})();