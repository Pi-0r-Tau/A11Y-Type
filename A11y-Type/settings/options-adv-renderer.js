(() => {
  "use strict";
  // R001
  // Refactor renderList to a generic function, simplied event listeners to closures and got rid of the heavy valdiation checks as closures will help more here.

  function renderList(container, emptyHtml, templateId, items, renderRow) {
    if (items.length === 0) {
      container.innerHTML = emptyHtml;
      return;
    }

    container.innerHTML = "";
    const template = document.getElementById(templateId);

    for (let i = 0; i < items.length; i++) {
      const row = template.content.cloneNode(true);
      renderRow(row, items[i], i);
      container.appendChild(row);
    }
  }

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
    renderList(
      elements.dictionaryList,
      '<p class="hint">No custom dictionaries uploaded yet.</p>',
      "tmpl-dict-row",
      state.customDictionaries,
      (row, entry, index) => {
        const count = helpers.countEntries(entry.content);

        row.querySelector("strong").textContent = entry.name;
        row.querySelector(".hint").textContent = `${count} entries`;

        const removeButton = row.querySelector("button");
        removeButton.addEventListener("click", () => {
          helpers.onRemoveDictionary(index);
        });
      }
    );
  }

  function renderRuleList(elements, state, helpers) {
    renderList(
      elements.ruleList,
      '<p class="section-intro">No host rules yet.</p>',
      "tmpl-rule-row",
      state.hostDictionaryRules,
      (row, rule, index) => {
        row.querySelector("strong").textContent = rule.hostPattern;
        row.querySelector(".hint").textContent = rule.set;

        const [upButton, downButton, removeButton] = row.querySelectorAll("button");

        upButton.addEventListener("click", () => {
          if (index <= 0) {
            return;
          }
          helpers.onMoveRule(index, index - 1);
        });

        downButton.addEventListener("click", () => {
          if (index >= state.hostDictionaryRules.length - 1) {
            return;
          }
          helpers.onMoveRule(index, index + 1);
        });

        removeButton.addEventListener("click", () => {
          helpers.onRemoveRule(index);
        });
      }
    );
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