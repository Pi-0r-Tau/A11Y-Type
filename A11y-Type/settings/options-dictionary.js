(() => {
  "use strict";

  // trimming, lowercasing, and removing duplicate of uploaded dictionary entries.
  // Returns a string with one entry per line.
  function normalizeDictionaryText(text) {
    const seen = new Set();
    const lines = String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line.length > 1)
      .filter((line) => {
        if (seen.has(line)) {
          return false;
        }
        seen.add(line);
        return true;
      });

    return lines.join("\n");
  }

  function countEntries(content) {
    if (!content) {
      return 0;
    }

    return String(content)
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0).length;
  }

  // URL-safe ID from a dictionary name.
  function makeDictionaryId(name) {
    const stem = String(name || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);

    return stem || `dict-${Date.now()}`;
  }

  window.__DPEK__ = window.__DPEK__ || {};
  window.__DPEK__.optionsDictionary = {
    normalizeDictionaryText,
    countEntries,
    makeDictionaryId
  };
})();
