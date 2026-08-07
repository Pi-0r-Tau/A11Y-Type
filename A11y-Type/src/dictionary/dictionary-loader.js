// R002
// OG dictionary loader which has been deleted as it was pretty unmaintainable from the original extension with some minor modifications to support custom dictionaries.

(() => {
  "use strict";

  function hostMatches(hostname, pattern) {
    const host = String(hostname || "").trim().toLowerCase();
    const rawPattern = String(pattern || "").trim().toLowerCase();

    if (!host || !rawPattern) {
      return false;
    }

    // So plain host means exact match only
    // and wildcard means subdomains only otherwise both inputs behave the same which is a bit pointless
    if (rawPattern.startsWith("*.")) {
      const suffix = rawPattern.slice(2);
      if (!suffix) {
        return false;
      }

      return host.endsWith(`.${suffix}`);
    }

    return host === rawPattern;
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

  function resolveDictionarySet(config, hostname) {
    for (const rule of config.hostDictionaryRules || []) {
      if (hostMatches(hostname, rule.hostPattern)) {
        return rule.set;
      }
    }

    return config.defaultDictionarySet;
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

  window.__DPEK__ = window.__DPEK__ || {};
  window.__DPEK__.dictionaryLoader = {
    hostMatches,
    resolveDictionarySet,
    resolveDictionarySources,
    fetchWordFile,
    expandDictionaryEntries,
    parseTextDictionary,
    normalizeDictionaryToken
  };
})();