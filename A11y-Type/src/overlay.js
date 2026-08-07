(() => {
    "use strict";
    // X index being 2147483647 as I want the overlay to always to be ontop.Bit of a silly number but this almost guarantees that it will always be on top.
    function createOverlay(initialSettings) {
        const styleTag = document.createElement("style");
        // CSS variables instead of direct values as I want to have dynamic colour updates without re rendering the DOM, so can apply changes directly via setProperty()
        // Also have stuff like pointer-events: none so the overlay does not intercept the cursor on page information. 
        styleTag.textContent = `
      .dpek-bubble {
        position: fixed;
        z-index: 2147483647;
        min-width: 220px;
        max-width: 320px;
        border-radius: 4px;
        border: 1px solid var(--dpek-border-color, #454545);
        background: var(--dpek-background-color, #252526);
        color: var(--dpek-text-color, #cccccc);
        box-shadow: 0 8px 22px rgba(0, 0, 0, 0.45);
        padding: 3px;
        font-family: "Segoe WPC", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        font-size: 12px;
        line-height: 1.25;
        pointer-events: none;
        opacity: 0;
        transform: translateY(4px);
        transition: opacity 120ms ease, transform 120ms ease;
      }

      .dpek-bubble.visible {
        opacity: 1;
        transform: translateY(0);
      }

      .dpek-item {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: 6px;
        border-radius: 3px;
        padding: 3px 6px;
        min-height: 22px;
      }

      .dpek-item.active {
        background: var(--dpek-active-background-color, #04395e);
        color: var(--dpek-active-text-color, #ffffff);
      }

      .dpek-word {
        font-weight: 400;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .dpek-hint {
        color: var(--dpek-hint-color, #9cdcfe);
        font-size: 11px;
        opacity: 0.92;
      }

      .dpek-item.active .dpek-hint {
        color: var(--dpek-active-hint-color, #c5e4ff);
      }
    `;
        document.documentElement.appendChild(styleTag);

        const bubble = document.createElement("div");
        bubble.className = "dpek-bubble";
        // WCAG fail but for testing this is going to be a purely visual assistance. Need to get software to test fully and get working correctly so probs like Dragon or Read and Write or even just read aloud stuff
        // But want to have whole sprint dedicated to visually impaired  users
        // Will also explore the usage of opacity for the overlay
        // SPIKE - 002VIU
        bubble.setAttribute("aria-hidden", "true");
        document.documentElement.appendChild(bubble);

        applySettings(initialSettings);

        return {
            render(suggestions, activeIndex) {
                bubble.innerHTML = "";
                // So build from DOM as lists are small 4 items max default and it also prevents stale event listeners / element references 
                for (let i = 0; i < suggestions.length; i++) {
                    const item = suggestions[i];
                    const itemDiv = document.createElement("div");
                    itemDiv.className = i === activeIndex ? "dpek-item active" : "dpek-item";

                    // Create word span
                    // textContent is safely as does not lead to HTML injection even though the suggestions come from the dictionary, dictionaries  can be uploaded by the user so want to avoid a user adding malware or something dumb
                    const wordSpan = document.createElement("span");
                    wordSpan.className = "dpek-word";
                    wordSpan.textContent = item.label;

                    // Create hint span
                    const hintSpan = document.createElement("span");
                    hintSpan.className = "dpek-hint";
                    hintSpan.textContent = item.nextKey;

                    itemDiv.appendChild(wordSpan);
                    itemDiv.appendChild(hintSpan);
                    bubble.appendChild(itemDiv);
                }

                bubble.classList.add("visible");
            },

            hide() {
                bubble.classList.remove("visible");
                bubble.innerHTML = "";
            },
            // AT012
            // is the overlay is currently being displayed
            isVisible() {
                return bubble.classList.contains("visible");
            },

            applySettings,

            position(targetRect, caret) {
                if (!bubble.classList.contains("visible")) {
                    return;
                }
                // position  below of caret by default with left offset
                let left = targetRect.left + caret.left - 6;
                let top = targetRect.top + caret.top + 22;

                // Flip to above if overlay extend below viewport with margin
                if (top + bubble.offsetHeight > window.innerHeight - 8) {
                    top = targetRect.top + caret.top - bubble.offsetHeight - 12;
                }

                // Clamp to viewport with 8px margin to prevent off screen mess
                const maxLeft = window.innerWidth - bubble.offsetWidth - 8;
                const maxTop = window.innerHeight - bubble.offsetHeight - 8;

                left = Math.max(8, Math.min(left, maxLeft));
                top = Math.max(8, Math.min(top, maxTop));

                bubble.style.left = `${left}px`;
                bubble.style.top = `${top}px`;
            }
        };

        function applySettings(settings) {
            if (!settings || typeof settings !== "object") {
                return;
            }

            bubble.style.minWidth = `${settings.minWidth}px`;
            bubble.style.maxWidth = `${settings.maxWidth}px`;
            bubble.style.borderRadius = `${settings.borderRadius}px`;
            bubble.style.fontSize = `${settings.fontSize}px`;

            bubble.style.setProperty("--dpek-background-color", settings.backgroundColor);
            bubble.style.setProperty("--dpek-text-color", settings.textColor);
            bubble.style.setProperty("--dpek-border-color", settings.borderColor);
            bubble.style.setProperty("--dpek-hint-color", settings.hintColor);
            bubble.style.setProperty("--dpek-active-background-color", settings.activeBackgroundColor);
            bubble.style.setProperty("--dpek-active-text-color", settings.activeTextColor);
            bubble.style.setProperty("--dpek-active-hint-color", settings.activeHintColor);
        }
    }

    window.__DPEK__ = window.__DPEK__ || {};
    window.__DPEK__.createOverlay = createOverlay;
})();