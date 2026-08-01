(() => {
    "use strict";

    // Style properties needed to accurately measure text caret position
    // Grouped by category so its clear as repeats are annoying
    const CARET_MEASUREMENT_STYLES = [
        // box model
        "boxSizing", "width", "height", "overflowX", "overflowY",
        // borders & padding
        "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
        "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
        // typography
        "fontStyle", "fontVariant", "fontWeight", "fontStretch", "fontSize", "fontFamily",
        "lineHeight", "letterSpacing", "textAlign", "textTransform", "textIndent", "textDecoration",
        "wordSpacing", "tabSize", "MozTabSize"
    ];

    // So can I actually work with this element
    function isElement(el) {
        return el instanceof HTMLElement;
    }

    function dispatchByFieldType(target, callbacks) {
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
            return callbacks.input(target);
        }

        if (isContentEditableField(target)) {
            return callbacks.contentEditable(target);
        }

        return callbacks.unsupported?.() ?? null;
    }

    function isSupportedField(element) {
        if (!isElement(element)) return false;

        if (element instanceof HTMLTextAreaElement) {
            return !element.readOnly && !element.disabled;
        }

        if (element instanceof HTMLInputElement) {
            const supported = new Set(["", "text", "search", "email", "url", "tel"]);
            return supported.has(element.type) && !element.readOnly && !element.disabled;
        }

        return isContentEditableField(element);
    }

    function isContentEditableField(element) {
        if (!isElement(element)) return false;
        // Check both the property and attribute; contenteditable="false" should be respected
        return element.isContentEditable === true && element.getAttribute("contenteditable") !== "false";
    }

    function getContext(target, tokenPattern) {
        return dispatchByFieldType(target, {
            input: (t) => {
                const caret = t.selectionStart;
                if (typeof caret !== "number") return null;

                const before = t.value.slice(0, caret);
                const match = before.match(tokenPattern);
                return { token: match ? match[0] : "" };
            },
            contentEditable: (t) => getContentEditableContext(t, tokenPattern),
            unsupported: () => null
        });
    }

    function getContentEditableContext(target, tokenPattern) {
        const selection = window.getSelection();
        if (!selection?.rangeCount) return null;

        const range = selection.getRangeAt(0);
        if (!target.contains(range.startContainer)) return null;

        const beforeRange = range.cloneRange();
        beforeRange.selectNodeContents(target);
        beforeRange.setEnd(range.endContainer, range.endOffset);

        const beforeText = beforeRange.toString();
        const match = beforeText.match(tokenPattern);
        return { token: match ? match[0] : "" };
    }

    function getCaretCoordinates(target) {
        return dispatchByFieldType(target, {
            input: getInputCaretCoordinates,
            contentEditable: getContentEditableCaretCoordinates,
            unsupported: () => ({ left: 0, top: target?.clientHeight || 0 })
        });
    }

    function getInputCaretCoordinates(target) {
        const position = target.selectionStart || 0;
        const mirror = document.createElement("div");
        const style = window.getComputedStyle(target);

        CARET_MEASUREMENT_STYLES.forEach(prop => {
            mirror.style[prop] = style[prop];
        });

        // Position off-screen and invisible
        Object.assign(mirror.style, {
            position: "absolute",
            visibility: "hidden",
            whiteSpace: "pre-wrap",
            wordWrap: "break-word",
            overflow: "hidden"
        });

        mirror.textContent = target.value.substring(0, position);
        const span = document.createElement("span");
        span.textContent = target.value.substring(position) || ".";
        mirror.appendChild(span);

        document.body.appendChild(mirror);
        const result = {
            top: span.offsetTop - target.scrollTop,
            left: span.offsetLeft - target.scrollLeft
        };
        document.body.removeChild(mirror);

        return result;
    }

    function getContentEditableCaretCoordinates(target) {
        const selection = window.getSelection();
        if (!selection?.rangeCount) {
            return { left: 0, top: target.clientHeight };
        }

        const range = selection.getRangeAt(0);
        if (!target.contains(range.startContainer)) {
            return { left: 0, top: target.clientHeight };
        }

        const collapsed = range.cloneRange();
        collapsed.collapse(true);

        let rect = collapsed.getBoundingClientRect();

        // Some contenteditable impls report 0x0 for caret rect; so using a marker to find real position bit hacky
        // so insert temporary zero-width space marker at caret, measure it, remove it. Gives the actual caret position even when the browser doesn't know/ wont tell me
        if (rect.width === 0 && rect.height === 0) {
            const marker = document.createElement("span");
            marker.textContent = "\u200b"; // zero-width space in question 
            collapsed.insertNode(marker);
            rect = marker.getBoundingClientRect();
            marker.parentNode?.removeChild(marker);
            selection.removeAllRanges();
            selection.addRange(collapsed);
        }

        const hostRect = target.getBoundingClientRect();
        return {
            left: rect.left - hostRect.left,
            top: rect.top - hostRect.top
        };
    }

    function applyCompletion(target, selectedWord, tokenPattern) {
        return dispatchByFieldType(target, {
            input: (t) => applyCompletionToInput(t, selectedWord, tokenPattern),
            contentEditable: (t) => applyCompletionToContentEditable(t, selectedWord, tokenPattern),
            unsupported: () => false
        });
    }

    function applyCompletionToInput(target, selectedWord, tokenPattern) {
        const start = target.selectionStart;
        const end = target.selectionEnd;
        if (typeof start !== "number" || typeof end !== "number") return false;

        const fullText = target.value;
        const before = fullText.slice(0, start);
        const match = before.match(tokenPattern);
        if (!match) return false;

        const token = match[0];
        const tokenStart = start - token.length;
        const replacement = `${selectedWord} `;

        target.value = `${fullText.slice(0, tokenStart)}${replacement}${fullText.slice(end)}`;
        const caretPos = tokenStart + replacement.length;
        target.selectionStart = caretPos;
        target.selectionEnd = caretPos;
        target.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
    }

    function applyCompletionToContentEditable(target, selectedWord, tokenPattern) {
        const selection = window.getSelection();
        if (!selection?.rangeCount) return false;

        const caretRange = selection.getRangeAt(0);
        if (!target.contains(caretRange.startContainer)) return false;

        const beforeRange = caretRange.cloneRange();
        beforeRange.selectNodeContents(target);
        beforeRange.setEnd(caretRange.endContainer, caretRange.endOffset);

        const beforeText = beforeRange.toString();
        const match = beforeText.match(tokenPattern);
        if (!match) return false;

        const token = match[0];
        const caretCharIndex = beforeText.length;
        const tokenStartIndex = caretCharIndex - token.length;

        const startPos = findTextPosition(target, tokenStartIndex);
        const endPos = findTextPosition(target, caretCharIndex);
        if (!startPos || !endPos) return false;

        const tokenRange = document.createRange();
        tokenRange.setStart(startPos.node, startPos.offset);
        tokenRange.setEnd(endPos.node, endPos.offset);
        tokenRange.deleteContents();

        const insertNode = document.createTextNode(`${selectedWord} `);
        tokenRange.insertNode(insertNode);

        // Position caret after inserted text
        const postRange = document.createRange();
        postRange.setStart(insertNode, insertNode.textContent.length);
        postRange.collapse(true);

        selection.removeAllRanges();
        selection.addRange(postRange);

        target.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
    }

    function findTextPosition(root, charIndex) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let traversed = 0;
        let current;

        while ((current = walker.nextNode())) {
            const len = current.textContent.length;
            if (traversed + len >= charIndex) {
                return {
                    node: current,
                    offset: Math.max(0, charIndex - traversed)
                };
            }
            traversed += len;
        }

        return null;
    }

    window.__DPEK__ = window.__DPEK__ || {};
    window.__DPEK__.fields = {
        isSupportedField,
        getContext,
        getCaretCoordinates,
        applyCompletion
    };
})();