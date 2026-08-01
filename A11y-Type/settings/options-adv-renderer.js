(() => {
  "use strict";

  function renderTargetOptions(elements, state) {
    const options = [{ value: "general", label: "General (built-in)" }];

    for (const dict of state.customDictionaries) {
      options.push({ value: `custom:${dict.id}`, label: `${dict.name} (custom)` });
    }

    const current = elements.ruleTarget.value;
    elements.ruleTarget.innerHTML = "";

    for (const option of options) {
      const optionEl = document.createElement("option");
      optionEl.value = option.value;
      optionEl.textContent = option.label;
      elements.ruleTarget.appendChild(optionEl);
    }

    if (options.some((option) => option.value === current)) {
      elements.ruleTarget.value = current;
    }
  }

  function renderDictionaryList(elements, state, helpers) {
    if (state.customDictionaries.length === 0) {
      elements.dictionaryList.innerHTML = '<p class="hint">No custom dictionaries uploaded yet.</p>';
      return;
    }

    elements.dictionaryList.innerHTML = "";
    const tmpl = document.getElementById("tmpl-dict-row");

    for (let i = 0; i < state.customDictionaries.length; i++) {
      const entry = state.customDictionaries[i];
      const count = helpers.countEntries(entry.content);

      const row = tmpl.content.cloneNode(true);
      row.querySelector("strong").textContent = entry.name;
      row.querySelector(".hint").textContent = `${count} entries`;

      const removeButton = row.querySelector("button");
      removeButton.setAttribute("data-remove-dict", String(i));
      removeButton.addEventListener("click", () => {
        const index = Number.parseInt(removeButton.getAttribute("data-remove-dict"), 10);
        if (!Number.isFinite(index)) {
          return;
        }

        helpers.onRemoveDictionary(index);
      });

      elements.dictionaryList.appendChild(row);
    }
  }

  function renderRuleList(elements, state, helpers) {
    if (state.hostDictionaryRules.length === 0) {
      elements.ruleList.innerHTML = '<p class="section-intro">No host rules yet.</p>';
      return;
    }

    elements.ruleList.innerHTML = "";
    const tmpl = document.getElementById("tmpl-rule-row");

    for (let i = 0; i < state.hostDictionaryRules.length; i++) {
      const rule = state.hostDictionaryRules[i];

      const row = tmpl.content.cloneNode(true);
      row.querySelector("strong").textContent = rule.hostPattern;
      row.querySelector(".hint").textContent = rule.set;

      const [upButton, downButton, removeButton] = row.querySelectorAll("button");

      upButton.setAttribute("data-up-rule", String(i));
      upButton.addEventListener("click", () => {
        const index = Number.parseInt(upButton.getAttribute("data-up-rule"), 10);
        if (!Number.isFinite(index) || index <= 0) {
          return;
        }

        helpers.onMoveRule(index, index - 1);
      });

      downButton.setAttribute("data-down-rule", String(i));
      downButton.addEventListener("click", () => {
        const index = Number.parseInt(downButton.getAttribute("data-down-rule"), 10);
        if (!Number.isFinite(index) || index >= state.hostDictionaryRules.length - 1) {
          return;
        }

        helpers.onMoveRule(index, index + 1);
      });

      removeButton.setAttribute("data-remove-rule", String(i));
      removeButton.addEventListener("click", () => {
        const index = Number.parseInt(removeButton.getAttribute("data-remove-rule"), 10);
        if (!Number.isFinite(index)) {
          return;
        }

        helpers.onRemoveRule(index);
      });

      elements.ruleList.appendChild(row);
    }
  }

  function setStatus(elements, message, isError) {
    elements.status.textContent = message;
    elements.status.style.color = isError ? "#f48771" : "#4fc1ff";
  }

  window.__DPEK__ = window.__DPEK__ || {};
  window.__DPEK__.optionsAdvRenderer = {
    renderTargetOptions,
    renderDictionaryList,
    renderRuleList,
    setStatus
  };
})();