console.log("Word Dictionary content script loaded");

let popup = null;

/* ================= MESSAGE LISTENER ================= */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "ping") {
        sendResponse({ status: "active" });
        return true;
    }

    if (msg.action === "showMeaning") {
        if (msg.meaning === "Looking up...") {
            showMeaning(msg.meaning, msg.x, msg.y, true);
        } else {
            showMeaning(msg.meaning, msg.x, msg.y, false);
        }
    }
    return true;
});

/* ================= POPUP FUNCTIONS ================= */

function showMeaning(text, x, y, isLookingUp = false) {
    // Remove existing popup if any
    if (popup) {
        popup.remove();
        popup = null;
    }

    popup = document.createElement("div");
    popup.id = "dictionary-popup";
    
    if (typeof text === 'object' && text.word) {
        // Structured meaning data
        popup.style.cssText = `
            position: absolute;
            background: #ffffff;
            border: 1px solid #ddd;
            padding: 14px 18px;
            border-radius: 10px;
            box-shadow: 0 6px 25px rgba(0,0,0,0.18);
            font-size: 14px;
            font-family: 'Segoe UI', 'Arial', sans-serif;
            max-width: 350px;
            min-width: 200px;
            word-wrap: break-word;
            z-index: 1000000;
            pointer-events: auto;
            opacity: 0;
            transition: opacity 0.3s ease, transform 0.3s ease;
            transform: translateY(-10px);
            line-height: 1.6;
            color: #333;
            cursor: default;
            border-left: 5px solid #3498db;
        `;
        
        let html = `
            <div style="position: relative;">
                <div style="font-weight: bold; color: #2c3e50; font-size: 18px; margin-bottom: 8px; padding-right: 20px;">
                    ${text.word}
                </div>
                <div style="position: absolute; top: 0; right: 0; cursor: pointer; color: #95a5a6; font-size: 18px; font-weight: bold; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: all 0.2s;" 
                     onmouseover="this.style.backgroundColor='#f0f0f0'; this.style.color='#e74c3c';" 
                     onmouseout="this.style.backgroundColor='transparent'; this.style.color='#95a5a6';"
                     onclick="this.closest('#dictionary-popup').style.opacity='0'; setTimeout(() => this.closest('#dictionary-popup')?.remove(), 300);">
                    ×
                </div>
            </div>`;
        
        if (text.phonetic) {
            html += `<div style="color: #7f8c8d; font-style: italic; font-size: 13px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #eee;">
                        Pronunciation: /${text.phonetic}/
                    </div>`;
        }
        
        if (text.meanings && text.meanings.length > 0) {
            text.meanings.slice(0, 2).forEach(meaning => {
                html += `<div style="color: #e74c3c; font-weight: 600; font-size: 13px; margin: 15px 0 8px 0; padding: 4px 0; border-bottom: 1px solid #f0f0f0;">
                            ${meaning.partOfSpeech}
                        </div>`;
                
                if (meaning.definitions && meaning.definitions.length > 0) {
                    meaning.definitions.slice(0, 3).forEach((def, index) => {
                        html += `<div style="margin: 10px 0 8px 0; padding-left: 12px; position: relative;">
                                    <span style="position: absolute; left: 0; color: #3498db; font-weight: bold;">${index + 1}.</span>
                                    <div style="margin-bottom: 4px;">${def.definition}</div>`;
                        
                        if (def.example) {
                            html += `<div style="color: #27ae60; font-style: italic; font-size: 12px; margin: 6px 0 8px 12px; padding-left: 8px; border-left: 2px solid #27ae60;">
                                        Example: "${def.example}"
                                    </div>`;
                        }
                        
                        html += `</div>`;
                    });
                }
            });
        }
        
        if (text.synonyms && text.synonyms.length > 0) {
            html += `<div style="margin-top: 15px; padding-top: 12px; border-top: 1px solid #eee;">
                        <div style="color: #8e44ad; font-weight: 600; font-size: 13px; margin-bottom: 6px;">
                            Synonyms:
                        </div>
                        <div style="color: #34495e; font-size: 13px; line-height: 1.8;">
                            ${text.synonyms.slice(0, 8).map(syn => `<span style="display: inline-block; background: #f8f9fa; padding: 2px 8px; margin: 2px 4px 2px 0; border-radius: 12px; border: 1px solid #e9ecef;">${syn}</span>`).join('')}
                        </div>
                    </div>`;
        }
        
        // Footer with instructions
        html += `<div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #eee; text-align: center;">
                    <small style="color: #95a5a6; font-size: 11px;">
                        Click outside or press ESC to close
                    </small>
                 </div>`;
        
        popup.innerHTML = html;
        
    } else {
        // Simple text message (for loading/error states)
        popup.style.cssText = `
            position: absolute;
            background: ${isLookingUp ? '#fffaf0' : text.includes('Error') ? '#fff5f5' : '#ffffff'};
            border: 1px solid #ddd;
            padding: 16px 20px;
            border-radius: 10px;
            box-shadow: 0 6px 25px rgba(0,0,0,0.18);
            font-size: 14px;
            font-family: 'Segoe UI', 'Arial', sans-serif;
            max-width: 300px;
            min-width: 180px;
            word-wrap: break-word;
            z-index: 1000000;
            pointer-events: auto;
            opacity: 0;
            transition: opacity 0.3s ease, transform 0.3s ease;
            transform: translateY(-10px);
            line-height: 1.6;
            color: ${isLookingUp ? '#666' : text.includes('Error') ? '#c0392b' : '#333'};
            cursor: default;
            border-left: 5px solid ${isLookingUp ? '#f39c12' : text.includes('Error') ? '#e74c3c' : '#2ecc71'};
            font-style: ${isLookingUp ? 'italic' : 'normal'};
        `;
        
        let closeButton = '';
        if (!isLookingUp) {
            closeButton = `
                <div style="position: absolute; top: 8px; right: 10px; cursor: pointer; color: #95a5a6; font-size: 18px; font-weight: bold; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: all 0.2s;" 
                     onmouseover="this.style.backgroundColor='#f0f0f0'; this.style.color='#e74c3c';" 
                     onmouseout="this.style.backgroundColor='transparent'; this.style.color='#95a5a6';"
                     onclick="this.closest('#dictionary-popup').style.opacity='0'; setTimeout(() => this.closest('#dictionary-popup')?.remove(), 300);">
                    ×
                </div>`;
        }
        
        popup.innerHTML = `
            <div style="position: relative;">
                <div style="padding-right: ${isLookingUp ? '0' : '30px'};">${text}</div>
                ${closeButton}
            </div>`;
        
        // Auto-remove only for "Looking up..." message after 4 seconds
        if (isLookingUp) {
            setTimeout(() => {
                if (popup && popup.innerHTML.includes("Looking up...")) {
                    popup.style.opacity = "0";
                    popup.style.transform = "translateY(-10px)";
                    setTimeout(() => {
                        popup?.remove();
                        popup = null;
                    }, 300);
                }
            }, 4000);
        }
    }

    document.body.appendChild(popup);

    /* === SIZE CALCULATION === */
    popup.style.visibility = "hidden";
    popup.style.display = "block";

    const rect = popup.getBoundingClientRect();
    const popupWidth = rect.width;
    const popupHeight = rect.height;

    popup.style.visibility = "visible";

    /* === POSITION NEAR SELECTION === */
    let finalX = x - popupWidth / 2;
    let finalY = y - popupHeight - 15;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Boundary checks
    if (finalX < 10) finalX = 10;
    if (finalX + popupWidth > viewportWidth - 10) {
        finalX = viewportWidth - popupWidth - 10;
    }

    if (finalY < 10) {
        finalY = y + 16;
    }

    popup.style.left = `${finalX}px`;
    popup.style.top = `${finalY}px`;

    // Animate in
    setTimeout(() => {
        popup.style.opacity = "1";
        popup.style.transform = "translateY(0)";
    }, 10);
}

function removePopup() {
    if (popup) {
        popup.style.opacity = "0";
        popup.style.transform = "translateY(-10px)";
        setTimeout(() => {
            popup?.remove();
            popup = null;
        }, 300);
    }
}

/* ================= SELECTION EVENTS ================= */

document.addEventListener("mouseup", (e) => {
    if (e.button !== 0) return;

    setTimeout(() => {
        const selection = window.getSelection();
        if (!selection) return;

        const text = selection.toString().trim();
        
        // Only process single words
        if (!text || text.split(/\s+/).length > 1) return;
        
        // Clean word (remove punctuation)
        const word = text.replace(/[^\w'-]/g, '');
        if (!word || word.length < 2) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        chrome.runtime.sendMessage({
            action: "lookupWord",
            word: word.toLowerCase(),
            x: rect.left + rect.width / 2 + window.scrollX,
            y: rect.top + window.scrollY
        });
    }, 120);
});

/* ================= DOUBLE CLICK EVENT ================= */

document.addEventListener("dblclick", () => {
    setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || !selection.toString().trim()) return;

        const text = selection.toString().trim();
        
        // Only process single words
        if (text.split(/\s+/).length > 1) return;
        
        const word = text.replace(/[^\w'-]/g, '');
        if (!word || word.length < 2) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        chrome.runtime.sendMessage({
            action: "lookupWord",
            word: word.toLowerCase(),
            x: rect.left + rect.width / 2 + window.scrollX,
            y: rect.top + window.scrollY
        });
    }, 80);
});

/* ================= CLOSE CONDITIONS ================= */

// Close when clicking outside the popup
document.addEventListener("mousedown", (e) => {
    if (popup && !popup.contains(e.target)) {
        removePopup();
    }
});

// Close on Escape key
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && popup) {
        removePopup();
    }
});

// Don't close on scroll for manual close version
// (comment out or remove the scroll listener)