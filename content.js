console.log("PDF Word Translator content script loaded");

let popup = null;
let hidePopupTimeout = null;
let isShowingTranslating = false;

/* ================= MESSAGE LISTENER ================= */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "ping") {
        sendResponse({ status: "active" });
        return true;
    }

    if (msg.action === "showTranslation") {
        if (msg.translatedText === "Translating...") {
            isShowingTranslating = true;
            showTranslation(msg.translatedText, msg.x, msg.y, true);
        } else {
            if (isShowingTranslating && popup) {
                updatePopup(msg.translatedText);
                isShowingTranslating = false;
            } else {
                showTranslation(msg.translatedText, msg.x, msg.y, false);
            }
        }
    }
    return true;
});

/* ================= POPUP FUNCTIONS ================= */

function showTranslation(text, x, y, isTranslating = false) {

    if (hidePopupTimeout) {
        clearTimeout(hidePopupTimeout);
        hidePopupTimeout = null;
    }

    if (!popup) {
        popup = document.createElement("div");
        popup.id = "translation-popup";

        popup.style.cssText = `
            position: absolute;
            background: #ffffff;
            border: 1px solid #ddd;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            font-size: 14px;
            font-family: 'Segoe UI', Arial, sans-serif;
            max-width: 320px;
            min-width: 120px;
            word-wrap: break-word;
            z-index: 1000000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.25s ease, transform 0.25s ease;
            transform: translateY(-8px);
            line-height: 1.5;
        `;

        document.body.appendChild(popup);
    }

    popup.textContent = text;

    if (isTranslating) {
        popup.style.borderLeft = "4px solid #FF9800";
        popup.style.color = "#666";
        popup.style.fontStyle = "italic";
        popup.style.background = "#fffaf0";
    } else {
        popup.style.borderLeft = "4px solid #4CAF50";
        popup.style.color = "#333";
        popup.style.fontStyle = "normal";
        popup.style.background = "#ffffff";
    }

    /* === SIZE CALCULATION === */
    popup.style.visibility = "hidden";
    popup.style.display = "block";

    const rect = popup.getBoundingClientRect();
    const popupWidth = rect.width;
    const popupHeight = rect.height;

    popup.style.visibility = "visible";

    /* === POSITION NEAR SELECTION === */
    let finalX = x - popupWidth / 2;
    let finalY = y - popupHeight - 12;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (finalX < 10) finalX = 10;
    if (finalX + popupWidth > viewportWidth - 10) {
        finalX = viewportWidth - popupWidth - 10;
    }

    if (finalY < 10) {
        finalY = y + 14;
    }

    popup.style.left = `${finalX}px`;
    popup.style.top = `${finalY}px`;

    setTimeout(() => {
        popup.style.opacity = "1";
        popup.style.transform = "translateY(0)";
    }, 10);

    /* === AUTO HIDE === */
    const autoRemoveTime = isTranslating ? 4000 : 10000;

    hidePopupTimeout = setTimeout(() => {
        if (isTranslating) return;
        removePopup();
    }, autoRemoveTime);
}

function updatePopup(newText) {
    if (!popup) return;

    popup.style.borderLeft = "4px solid #4CAF50";
    popup.style.color = "#333";
    popup.style.fontStyle = "normal";
    popup.style.background = "#ffffff";
    popup.style.opacity = "0.85";

    setTimeout(() => {
        popup.textContent = newText;
        popup.style.opacity = "1";

        if (hidePopupTimeout) clearTimeout(hidePopupTimeout);
        hidePopupTimeout = setTimeout(removePopup, 10000);
    }, 120);
}

function removePopup() {
    if (hidePopupTimeout) {
        clearTimeout(hidePopupTimeout);
        hidePopupTimeout = null;
    }

    isShowingTranslating = false;

    if (popup) {
        popup.style.opacity = "0";
        popup.style.transform = "translateY(-8px)";
        setTimeout(() => {
            popup?.remove();
            popup = null;
        }, 250);
    }
}

/* ================= SELECTION EVENTS ================= */

/* === DOUBLE CLICK (WORD / SENTENCE) === */
document.addEventListener("dblclick", () => {
    setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || !selection.toString().trim()) return;

        const text = selection.toString().trim();
        if (text.length > 300) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        chrome.runtime.sendMessage({
            action: "translate",
            text,
            x: rect.left + rect.width / 2 + window.scrollX,
            y: rect.top + window.scrollY
        });
    }, 80);
});

/* === MOUSE SELECTION (WORD / SENTENCE) === */
document.addEventListener("mouseup", (e) => {
    if (e.button !== 0) return;

    setTimeout(() => {
        const selection = window.getSelection();
        if (!selection) return;

        const text = selection.toString().trim();
        if (!text || text.length > 300) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        chrome.runtime.sendMessage({
            action: "translate",
            text,
            x: rect.left + rect.width / 2 + window.scrollX,
            y: rect.top + window.scrollY
        });
    }, 120);
});

/* ================= CLOSE CONDITIONS ================= */

document.addEventListener("mousedown", () => {
    if (popup) removePopup();
});

window.addEventListener("scroll", removePopup, { passive: true });

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") removePopup();
});
