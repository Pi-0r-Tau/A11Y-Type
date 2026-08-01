(() => {
    "use strict";

    function createState() {
        return {
            target: null,
            suggestions: [],
            activeIndex: 0,
            lastToken: "",
            dictionarywords: [],
            dictionaryBuckets: new Map(),
            commonWordRanks: new Map(),
            correctionMap: new Map(),
            dictionaryIndex: null,

            // Cache for incremental prefix typing
            suggestionCache: {
                lastPrefix: "",
                lastResults: []
            }
        };
    }

    window._DPEK_ = window._DPEK_ || {};
    window._DPEK_.createState = createState;
})();