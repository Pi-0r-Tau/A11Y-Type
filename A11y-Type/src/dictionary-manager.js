(() => {
    "use strict";
    function createDictionaryManager(config, state) {
        return {
            async initialize() {
                await Promise.all([
                    loadCommonWordRanks(config, state),
                    loadActiveDictionaryWords(config, state),
                    loadCorrectionMap(config, state)
                ]);
            },

            getSuggestions(prefix, limit) {
                return getSuggestions(prefix, limit, state);
            }
        };
    }

    async function loadActiveDictionaryWords(config, state) {
        const merged = new Set();

        const sources = await resolveDictionarySources(config, window.location.hostname || "");
        for (const source of sources) {
            const expanded = expandDictionaryEntries(source);
            for (const word of expanded) {
                merged.add(word);
            }
        }

        if (merged.size > 0) {
            state.dictionaryWords = Array.from(merged);
            buildBuckets(state.dictionaryWords, state);
            return;
        }

        buildBuckets(state.dictionaryWords, state);
    }

    async function resolveDictionarySources(config, hostname) {
        const activeSetName = resolveDictionarySet(config, hostname);

        if (activeSetName.startsWith("custom:")) {
            const customId = activeSetName.slice("custom:".length);
            const custom = (config.customDictionaries || []).find((entry) => entry.id === customId);
            const generalSet = config.dictionarySets[config.defaultDictionarySet] || [];

            const sources = [];
            for (const relativePath of generalSet) {
                sources.push(await fetchWordFile(relativePath, false));
            }

            if (custom && custom.content) {
                sources.push(parseTextDictionary(custom.content));
            }

            return sources;
        }

        const dictionaryFiles = config.dictionarySets[activeSetName]
            || config.dictionarySets[config.defaultDictionarySet]
            || [];

        const sources = [];
        for (const relativePath of dictionaryFiles) {
            sources.push(await fetchWordFile(relativePath, false));
        }
        return sources;
    }

    function resolveDictionarySet(config, hostname) {
        for (const rule of config.hostDictionaryRules || []) {
            if (hostMatches(hostname, rule.hostPattern)) {
                return rule.set;
            }
        }

        return config.defaultDictionarySet;
    }

    function hostMatches(hostname, pattern) {
        const host = String(hostname || "").trim().toLowerCase();
        const rawPattern = String(pattern || "").trim().toLowerCase();

        if (!host || !rawPattern) {
            return false;
        }

        const normalized = rawPattern.startsWith("*.") ? rawPattern.slice(2) : rawPattern;
        return host === normalized || host.endsWith(`.${normalized}`);
    }

    async function loadCommonWordRanks(config, state) {
        const rankWords = await fetchWordFile(config.commonRankFile, false);

        if (rankWords.length === 0) {
            return;
        }

        const rankMap = new Map();

        for (let i = 0; i < rankWords.length; i++) {
            const normalized = normalizeDictionaryToken(rankWords[i]);
            if (normalized && !rankMap.has(normalized)) {
                rankMap.set(normalized, i + 1);
            }
        }

        state.commonWordRanks = rankMap;
    }
   // AT008
 // So now if I type aboveboard it will automatically add a hypen on tab or the character used for autocomplete. This is because the dictionary contains both forms, and the normalized form is used for matching.
    async function loadCorrectionMap(config, state) {
        if (!config.correctionsFile) return;

        try {
            const fileUrl = chrome.runtime.getURL(config.correctionsFile);
            const response = await fetch(fileUrl);
            if (!response.ok) return;

            const text = await response.text();
            const map = new Map();

            for (const line of text.split(/\r?\n/)) {
                const tab = line.indexOf("\t");
                if (tab === -1) continue;

                const key = normalizeDictionaryToken(line.slice(0, tab));
                const preferred = line.slice(tab + 1).trim();

                if (key && preferred && !map.has(key)) {
                    map.set(key, preferred);
                }
            }

            state.correctionMap = map;
        } catch (_err) { }
    }

    async function fetchWordFile(relativePath, alphaOnly = true) {
        try {
            const fileUrl = chrome.runtime.getURL(relativePath);
            const response = await fetch(fileUrl);
            if (!response.ok) {
                return [];
            }

            const text = await response.text();
            return text
                .split(/\r?\n/)
                .map((line) => line.trim().toLowerCase())
                .filter((line) => line.length > 1)
                .filter((line) => alphaOnly ? /^[\p{L}]+$/u.test(line) : true);
        } catch (_err) {
            return [];
        }
    }

    function expandDictionaryEntries(entries) {
        const out = new Set();

        for (const entry of entries) {
            const normalizedLine = String(entry || "").trim().toLowerCase();
            if (normalizedLine.length <= 1) {
                continue;
            }

            out.add(normalizedLine);

            const tokens = normalizedLine
                .split(/\s+/)
                .map((token) => token.trim())
                .filter((token) => token.length > 1);

            for (const token of tokens) {
                out.add(token);
            }
        }

        return out;
    }

    function parseTextDictionary(text) {
        return String(text || "")
            .split(/\r?\n/)
            .map((line) => line.trim().toLowerCase())
            .filter((line) => line.length > 1);
    }

    function normalizeDictionaryToken(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/['']/g, "")
            .replace(/æ/g, "ae")
            .replace(/œ/g, "oe")
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z]/g, "");
    }

    function buildBuckets(words, state) {
        const buckets = new Map();
        const records = [];
        // AT008.1
        // Deduplicate by normalized form to avoid duplicates in suggestions
        // Bug in the suggestions leading to words with "'" being suggested multiple times, e.g., "don't" and "dont" 
        // as well as multiple times in the suggestions list. This is because the dictionary contains both forms, and the normalized form is used for matching.
        const seenNorms = new Set();  // deduplicate by normalized form

        const sorted = words.slice().sort((a, b) => /['']/u.test(b) - /['']/u.test(a));

        for (const word of sorted) {
            const norm = normalizeDictionaryToken(word);
            if (norm.length < 2) {
                continue;
            }

            if (seenNorms.has(norm)) {
                continue;
            }
            seenNorms.add(norm);

            const record = { word, norm };
            records.push(record);

            const keyOne = norm.slice(0, 1);
            const keyTwo = norm.slice(0, 2);

            if (!buckets.has(keyOne)) {
                buckets.set(keyOne, []);
            }
            if (!buckets.has(keyTwo)) {
                buckets.set(keyTwo, []);
            }

            buckets.get(keyOne).push(record);
            buckets.get(keyTwo).push(record);
        }

        state.dictionaryWords = records;
        state.dictionaryBuckets = buckets;
    }

    function getSuggestions(prefix, limit, state) {
        const normalized = normalizeDictionaryToken(prefix);
        if (normalized.length === 0) {
            return [];
        }

        const keyTwo = normalized.slice(0, 2);
        const keyOne = normalized.slice(0, 1);
        const pool = state.dictionaryBuckets.get(keyTwo)
            || state.dictionaryBuckets.get(keyOne)
            || state.dictionaryWords;

        const ranked = pool
            .filter((entry) => entry.norm.startsWith(normalized))
            .sort((a, b) => compareByLikelihood(a, b, state))
            .map((entry) => entry.word);

        const preferred = state.correctionMap.get(normalized);
        if (!preferred) {
            return ranked.slice(0, limit);
        }

        const preferredNorm = normalizeDictionaryToken(preferred);
        const deduped = ranked.filter((word) => normalizeDictionaryToken(word) !== preferredNorm);

        return [preferred, ...deduped].slice(0, limit);
    }

    function compareByLikelihood(a, b, state) {
        const rankA = state.commonWordRanks.has(a.norm) ? state.commonWordRanks.get(a.norm) : Number.MAX_SAFE_INTEGER;
        const rankB = state.commonWordRanks.has(b.norm) ? state.commonWordRanks.get(b.norm) : Number.MAX_SAFE_INTEGER;

        if (rankA !== rankB) {
            return rankA - rankB;
        }

        if (a.word.length !== b.word.length) {
            return a.word.length - b.word.length;
        }

        return a.word.localeCompare(b.word);
    }

    window.__DPEK__ = window.__DPEK__ || {};
    window.__DPEK__.createDictionaryManager = createDictionaryManager;
})();