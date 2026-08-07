// R002.3 continuation of R002.2, which is a continuation of R002. OG dictionary manger to ranker split.
// Was having a couple of annoying issues and bugs so although really for a browser extension having this many files is overkill and will annoy
// me later down the line. This approach served me well for EPI-LENS which has I think 40 files
(() => {
    "use strict";

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
    window.__DPEK__.dictionaryRanker = {
        buildBuckets,
        getSuggestions,
        compareByLikelihood
    };
})();