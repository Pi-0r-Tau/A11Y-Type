(() => {
  "use strict";

  const dpek = window.__DPEK__ || {};
  const advancedStorageKey = dpek.ADVANCED_SETTINGS_STORAGE_KEY;
  const resolveRuntimeConfig = dpek.resolveRuntimeConfig;
  const optionsDictionary = dpek.optionsDictionary;
  const advancedRenderer = dpek.optionsAdvRenderer;

  if (!advancedStorageKey || !resolveRuntimeConfig || !optionsDictionary || !advancedRenderer || !chrome.storage || !chrome.storage.local) {
    return;
  }

  const state = {
    customDictionaries: [],
    hostDictionaryRules: []
  };

  const elements = {
    dictionaryName: document.getElementById("dictionaryName"),
    dictionaryFile: document.getElementById("dictionaryFile"),
    uploadButton: document.getElementById("uploadButton"),
    dictionaryList: document.getElementById("dictionaryList"),
    hostPattern: document.getElementById("hostPattern"),
    ruleTarget: document.getElementById("ruleTarget"),
    addRuleButton: document.getElementById("addRuleButton"),
    ruleList: document.getElementById("ruleList"),
    saveButton: document.getElementById("saveButton"),
    resetButton: document.getElementById("resetButton"),
    status: document.getElementById("status")
  };

    const renderHelpers = {
    countEntries(content) {
      return optionsDictionary.countEntries(content);
    },
    onRemoveDictionary(index) {
      const removed = state.customDictionaries[index];
      if (!removed) {
        return;
      }

      state.customDictionaries.splice(index, 1);
      state.hostDictionaryRules = state.hostDictionaryRules.filter((rule) => rule.set !== `custom:${removed.id}`);
      render();
      setStatus("Dictionary removed. Save to apply.", false);
    },
    onMoveRule(index, targetIndex) {
      swapRules(index, targetIndex);
      render();
      setStatus("Rule order updated. Save to apply.", false);
    },
    onRemoveRule(index) {
      state.hostDictionaryRules.splice(index, 1);
      render();
      setStatus("Rule removed. Save to apply.", false);
    }
  };

  elements.uploadButton.addEventListener("click", onUploadDictionary);
  elements.addRuleButton.addEventListener("click", onAddRule);
  elements.saveButton.addEventListener("click", onSaveAdvanced);
  elements.resetButton.addEventListener("click", onResetAdvanced);

  loadAdvanced();

  function loadAdvanced() {
    chrome.storage.local.get([advancedStorageKey], (result) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        setStatus("Failed to load advanced settings", true);
        return;
      }

      const raw = result ? result[advancedStorageKey] : null;
      const runtime = resolveRuntimeConfig(null, raw);
      state.customDictionaries = (runtime.customDictionaries || []).map((entry) => ({ ...entry }));
      state.hostDictionaryRules = (runtime.hostDictionaryRules || []).map((entry) => ({ ...entry }));
      render();
      setStatus("Loaded", false);
    });
  }

  async function onUploadDictionary() {
    const file = elements.dictionaryFile.files && elements.dictionaryFile.files[0];
    const name = String(elements.dictionaryName.value || "").trim();

    if (!file) {
      setStatus("Select a dictionary file first", true);
      return;
    }

    if (!name) {
      setStatus("Provide a dictionary display name", true);
      return;
    }

    try {
      const text = await file.text();
      const content = optionsDictionary.normalizeDictionaryText(text);
      if (!content) {
        setStatus("Dictionary file is empty after cleanup", true);
        return;
      }

      const id = optionsDictionary.makeDictionaryId(name);
      const existingIndex = state.customDictionaries.findIndex((entry) => entry.id === id);
      const next = {
        id,
        name,
        content
      };

      if (existingIndex >= 0) {
        state.customDictionaries[existingIndex] = next;
      } else {
        state.customDictionaries.push(next);
      }

      elements.dictionaryName.value = "";
      elements.dictionaryFile.value = "";
      render();
      setStatus("Dictionary uploaded. Save to apply.", false);
    } catch (_err) {
      setStatus("Failed to read dictionary file", true);
    }
  }

  function onAddRule() {
    const hostPattern = String(elements.hostPattern.value || "").trim().toLowerCase();
    const set = String(elements.ruleTarget.value || "").trim();

    if (!hostPattern) {
      setStatus("Enter a host pattern", true);
      return;
    }

    if (!set) {
      setStatus("Select a dictionary target", true);
      return;
    }

    state.hostDictionaryRules.push({ hostPattern, set });
    elements.hostPattern.value = "";
    render();
    setStatus("Rule added. Save to apply.", false);
  }

  function onSaveAdvanced() {
    const payload = {
      customDictionaries: state.customDictionaries,
      hostDictionaryRules: state.hostDictionaryRules
    };

    const runtime = resolveRuntimeConfig(null, payload);
    const normalized = {
      customDictionaries: runtime.customDictionaries,
      hostDictionaryRules: runtime.hostDictionaryRules
    };

    chrome.storage.local.set({ [advancedStorageKey]: normalized }, () => {
      if (chrome.runtime && chrome.runtime.lastError) {
        setStatus("Failed to save advanced settings", true);
        return;
      }

      state.customDictionaries = normalized.customDictionaries.map((entry) => ({ ...entry }));
      state.hostDictionaryRules = normalized.hostDictionaryRules.map((entry) => ({ ...entry }));
      render();
      setStatus("Advanced settings saved", false);
    });
  }

  function onResetAdvanced() {
    chrome.storage.local.remove([advancedStorageKey], () => {
      if (chrome.runtime && chrome.runtime.lastError) {
        setStatus("Failed to reset advanced settings", true);
        return;
      }

      state.customDictionaries = [];
      state.hostDictionaryRules = [];
      render();
      setStatus("Advanced settings reset", false);
    });
  }

  function render() {
    advancedRenderer.renderTargetOptions(elements, state);
    advancedRenderer.renderDictionaryList(elements, state, renderHelpers);
    advancedRenderer.renderRuleList(elements, state, renderHelpers);
  }

  function swapRules(a, b) {
    const tmp = state.hostDictionaryRules[a];
    state.hostDictionaryRules[a] = state.hostDictionaryRules[b];
    state.hostDictionaryRules[b] = tmp;
  }

  function setStatus(message, isError) {
    advancedRenderer.setStatus(elements, message, isError);
  }
})();