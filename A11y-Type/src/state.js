(() => {
    "use strict";

    function createState() {
        return {
            target: null,
            suggestions: [],
            activeIndex: 0,
            lastToken: "",
            dictionaryWords: [],
            dictionaryBuckets: new Map(),
            commonWordRanks: new Map(),
            correctionMap: new Map()
        };
    }

    window.__DPEK__ = window.__DPEK__ || {};
    window.__DPEK__.createState = createState;
})();