// Create context menu on installation
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "lookup-word",
        title: "Look up meaning in English",
        contexts: ["selection"]
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "lookup-word" && info.selectionText) {
        const text = info.selectionText.trim();
        
        // Only process single words
        if (text.split(/\s+/).length === 1) {
            ensureContentScriptInjected(tab.id).then(() => {
                lookupWordMeaning(text.toLowerCase(), tab.id);
            }).catch(error => {
                console.error("Failed to inject content script:", error);
                lookupWordMeaning(text.toLowerCase(), tab.id);
            });
        }
    }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg.action === "lookupWord" && msg.word) {
        lookupWordMeaning(msg.word, sender.tab.id, msg.x, msg.y);
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

// Main word lookup function
function lookupWordMeaning(word, tabId, x = null, y = null) {
    console.log("Looking up word:", word);
    
    // Send "Looking up..." message immediately
    if (tabId) {
        sendToContentScript(tabId, {
            action: "showMeaning",
            meaning: "Looking up...",
            x: x || 100,
            y: y || 100
        });
    }
    
    // Small delay before actual lookup to ensure popup is visible
    setTimeout(() => {
        getWordDefinition(word, tabId, x, y);
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

// Method 1: Dictionary API (Primary)
function getWordDefinition(word, tabId, x, y) {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error("Word not found");
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Dictionary API response:", data);
            
            let result = "";
            
            if (Array.isArray(data) && data.length > 0) {
                const wordData = data[0];
                const formattedData = formatDictionaryData(wordData);
                
                if (tabId) {
                    sendToContentScript(tabId, {
                        action: "showMeaning",
                        meaning: formattedData,
                        x: x || 100,
                        y: y || 100
                    });
                }
            } else {
                throw new Error("No definitions found");
            }
        })
        .catch(error => {
            console.error("Dictionary API error:", error);
            getWordDefinitionFallback(word, tabId, x, y);
        });
}

// Format dictionary data
function formatDictionaryData(wordData) {
    const result = {
        word: wordData.word,
        phonetic: wordData.phonetic || (wordData.phonetics && wordData.phonetics[0] && wordData.phonetics[0].text) || '',
        meanings: [],
        synonyms: []
    };
    
    if (wordData.meanings && wordData.meanings.length > 0) {
        result.meanings = wordData.meanings.map(meaning => ({
            partOfSpeech: meaning.partOfSpeech,
            definitions: meaning.definitions ? meaning.definitions.slice(0, 3).map(def => ({
                definition: def.definition,
                example: def.example || ''
            })) : []
        }));
        
        // Extract synonyms
        const allSynonyms = new Set();
        wordData.meanings.forEach(meaning => {
            if (meaning.synonyms) {
                meaning.synonyms.forEach(syn => allSynonyms.add(syn));
            }
            if (meaning.definitions) {
                meaning.definitions.forEach(def => {
                    if (def.synonyms) {
                        def.synonyms.forEach(syn => allSynonyms.add(syn));
                    }
                });
            }
        });
        result.synonyms = Array.from(allSynonyms).slice(0, 8);
    }
    
    return result;
}

// Method 2: Datamuse API (Fallback)
function getWordDefinitionFallback(word, tabId, x, y) {
    const url = `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=d&max=5`;
    
    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            console.log("Datamuse response:", data);
            
            if (data.length > 0 && data[0].defs) {
                // Format the definitions
                const definitions = data[0].defs.slice(0, 3).map(def => {
                    const parts = def.split('\t');
                    return {
                        partOfSpeech: parts[0] ? parts[0].replace(/^[a-z]+\.$/, '$&') : 'n.',
                        definition: parts[1] || def
                    };
                });
                
                const formattedData = {
                    word: word,
                    phonetic: '',
                    meanings: [{
                        partOfSpeech: 'various',
                        definitions: definitions
                    }],
                    synonyms: []
                };
                
                if (tabId) {
                    sendToContentScript(tabId, {
                        action: "showMeaning",
                        meaning: formattedData,
                        x: x || 100,
                        y: y || 100
                    });
                }
            } else {
                if (tabId) {
                    sendToContentScript(tabId, {
                        action: "showMeaning",
                        meaning: `No English definition found for "${word}"`,
                        x: x || 100,
                        y: y || 100
                    });
                }
            }
        })
        .catch(error => {
            console.error("Datamuse API error:", error);
            
            if (tabId) {
                sendToContentScript(tabId, {
                    action: "showMeaning",
                    meaning: `Error: Could not fetch definition for "${word}"`,
                    x: x || 100,
                    y: y || 100
                });
            }
        });
}