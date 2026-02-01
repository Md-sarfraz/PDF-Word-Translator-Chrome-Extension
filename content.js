console.log("Word Dictionary content script loaded");

let popup = null;

/* ================= MESSAGE LISTENER ================= */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "ping") {
        sendResponse({ status: "active" });
        return true;
    }

    if (msg.action === "showMeaning") {
        showMeaning(msg.meaning, msg.isLookingUp || false);
    }
    return true;
});

/* ================= POPUP FUNCTION ================= */

function showMeaning(text, isLookingUp = false) {
    if (popup) popup.remove();

    popup = document.createElement("div");
    popup.id = "dictionary-popup";

    popup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0.96);
        background: #ffffff;
        border-radius: 14px;
        box-shadow: 0 14px 40px rgba(0,0,0,0.28);
        font-family: 'Segoe UI', system-ui, Arial, sans-serif;
        font-size: 14px;
        color: #2c3e50;

        width: 440px;
        max-width: 92vw;
        height: 340px;
        max-height: 82vh;

        padding: 18px 20px;
        overflow-y: auto;
        overflow-x: hidden;

        z-index: 1000000;
        opacity: 0;
        transition: all 0.25s ease;
    `;

    /* ===== Scrollbar Styling ===== */
    popup.style.scrollbarWidth = "thin";
    popup.style.scrollbarColor = "#bbb transparent";

    /* ================= CONTENT ================= */

    if (typeof text === "object" && text.word) {
        let html = `
            <div style="
                position: sticky;
                top: -18px;
                background: #fff;
                padding: 6px 0 12px 0;
                z-index: 10;
            ">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-size:20px; font-weight:700;">
                        ${text.word}
                    </div>
                    <div style="
                        cursor:pointer;
                        font-size:22px;
                        color:#999;
                        padding: 2px 8px;
                        border-radius: 50%;
                    " onclick="this.closest('#dictionary-popup').remove()">×</div>
                </div>

                ${text.phonetic ? `
                    <div style="font-size:13px; color:#777; margin-top:2px;">
                        /${text.phonetic}/
                    </div>` : ""}

                <hr style="margin:12px 0">
            </div>
        `;

        text.meanings?.slice(0, 2).forEach(meaning => {
            html += `
                <div style="margin-bottom:18px;">
                    <div style="
                        color:#e74c3c;
                        font-weight:600;
                        margin-bottom:8px;
                        text-transform: capitalize;
                    ">
                        ${meaning.partOfSpeech}
                    </div>
            `;

            meaning.definitions?.slice(0, 3).forEach((def, i) => {
                html += `
                    <div style="margin-left:12px; margin-bottom:10px;">
                        <div style="line-height:1.7;">
                            <b>${i + 1}.</b> ${def.definition}
                        </div>
                        ${def.example ? `
                            <div style="
                                font-size:12px;
                                color:#27ae60;
                                margin-top:6px;
                                padding-left:10px;
                                border-left:3px solid #27ae60;
                            ">
                                "${def.example}"
                            </div>` : ""}
                    </div>
                `;
            });

            html += `</div>`;
        });

        if (text.synonyms?.length) {
            html += `
                <div style="margin-top:10px;">
                    <div style="font-weight:600; color:#8e44ad; margin-bottom:6px;">
                        Synonyms
                    </div>
                    <div>
                        ${text.synonyms.map(s => `
                            <span style="
                                display:inline-block;
                                background:#f4f6f8;
                                padding:4px 10px;
                                margin:4px 6px 0 0;
                                border-radius:14px;
                                font-size:12px;
                            ">
                                ${s}
                            </span>
                        `).join("")}
                    </div>
                </div>
            `;
        }

        popup.innerHTML = html;
    } else {
        popup.innerHTML = `
            <div style="display:flex; justify-content:space-between; gap:10px;">
                <div style="line-height:1.6;">${text}</div>
                ${!isLookingUp ? `<div style="cursor:pointer;font-size:22px;" onclick="this.closest('#dictionary-popup').remove()">×</div>` : ""}
            </div>
        `;
    }

    document.body.appendChild(popup);

    setTimeout(() => {
        popup.style.opacity = "1";
        popup.style.transform = "translate(-50%, -50%) scale(1)";
    }, 10);
}


/* ================= REMOVE POPUP ================= */

function removePopup() {
    if (!popup) return;
    popup.style.opacity = "0";
    popup.style.transform = "translate(-50%, -50%) scale(0.95)";
    setTimeout(() => popup?.remove(), 300);
}

/* ================= SELECTION EVENTS ================= */

document.addEventListener("mouseup", () => {
    setTimeout(() => {
        const selection = window.getSelection();
        if (!selection) return;

        const text = selection.toString().trim();
        if (!text || text.split(/\s+/).length > 1) return;

        const word = text.replace(/[^\w'-]/g, '');
        if (word.length < 2) return;

        chrome.runtime.sendMessage({
            action: "lookupWord",
            word: word.toLowerCase()
        });
    }, 120);
});

document.addEventListener("dblclick", () => {
    setTimeout(() => {
        const selection = window.getSelection();
        if (!selection) return;

        const text = selection.toString().trim();
        if (!text || text.split(/\s+/).length > 1) return;

        const word = text.replace(/[^\w'-]/g, '');
        if (word.length < 2) return;

        chrome.runtime.sendMessage({
            action: "lookupWord",
            word: word.toLowerCase()
        });
    }, 80);
});

/* ================= CLOSE CONDITIONS ================= */

document.addEventListener("mousedown", (e) => {
    if (popup && !popup.contains(e.target)) {
        removePopup();
    }
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        removePopup();
    }
});
