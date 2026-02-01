// Create context menu on installation
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "translate-selection",
        title: "Translate to Hindi",
        contexts: ["selection"]
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "translate-selection" && info.selectionText) {
        // Ensure content script is injected before translating
        ensureContentScriptInjected(tab.id).then(() => {
            translateText(info.selectionText, tab.id);
        }).catch(error => {
            console.error("Failed to inject content script:", error);
            translateText(info.selectionText, tab.id);
        });
    }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg.action === "translate" && msg.text) {
        translateText(msg.text, sender.tab.id, msg.x, msg.y);
    }
});

// Ensure content script is injected in the tab
function ensureContentScriptInjected(tabId) {
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, { action: "ping" }, (response) => {
            if (chrome.runtime.lastError) {
                console.log("Content script not found, injecting...");
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content.js']
                }).then(() => {
                    console.log("Content script injected successfully");
                    // Give it a moment to initialize
                    setTimeout(() => resolve(), 100);
                }).catch(error => {
                    console.error("Failed to inject content script:", error);
                    reject(error);
                });
            } else {
                resolve();
            }
        });
    });
}

// Main translation function
function translateText(text, tabId, x = null, y = null) {
    console.log("Translating:", text);
    
    // Send "Translating..." message immediately
    if (tabId) {
        sendToContentScript(tabId, {
            action: "showTranslation",
            translatedText: "Translating...",
            x: x || 100,
            y: y || 100
        });
    }
    
    // Small delay before actual translation to ensure popup is visible
    setTimeout(() => {
        translateWithGoogle(text, tabId, x, y);
    }, 100);
}

// Safe function to send messages to content script
function sendToContentScript(tabId, message) {
    chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
            console.log("Content script not ready, will inject and retry...");
            ensureContentScriptInjected(tabId).then(() => {
                setTimeout(() => {
                    chrome.tabs.sendMessage(tabId, message, (retryResponse) => {
                        if (chrome.runtime.lastError) {
                            console.error("Still can't reach content script:", chrome.runtime.lastError);
                        }
                    });
                }, 200);
            });
        }
    });
}

// Method 1: Google Translate
function translateWithGoogle(text, tabId, x, y) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q=${encodeURIComponent(text)}`;
    
    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            console.log("Google translate response:", data);
            let translatedText = "";
            
            if (data && data[0] && data[0][0] && data[0][0][0]) {
                translatedText = data[0][0][0];
            } else {
                translatedText = "Translation not available";
            }
            
            if (tabId) {
                sendToContentScript(tabId, {
                    action: "showTranslation",
                    translatedText: translatedText,
                    x: x || 100,
                    y: y || 100
                });
            }
        })
        .catch(error => {
            console.error("Google translate error:", error);
            translateWithMyMemory(text, tabId, x, y);
        });
}

// Method 2: MyMemory Translation API (fallback)
function translateWithMyMemory(text, tabId, x, y) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|hi`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            console.log("MyMemory response:", data);
            let translatedText = "";
            
            if (data && data.responseData && data.responseData.translatedText) {
                translatedText = data.responseData.translatedText;
            } else {
                translatedText = "Could not translate";
            }
            
            if (tabId) {
                sendToContentScript(tabId, {
                    action: "showTranslation",
                    translatedText: translatedText,
                    x: x || 100,
                    y: y || 100
                });
            }
        })
        .catch(error => {
            console.error("All translation APIs failed:", error);
            
            if (tabId) {
                sendToContentScript(tabId, {
                    action: "showTranslation",
                    translatedText: `Error: Service unavailable`,
                    x: x || 100,
                    y: y || 100
                });
            }
        });
}