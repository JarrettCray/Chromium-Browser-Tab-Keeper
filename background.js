let debounceTimeout = null;
let isRestoring = false;
let memoryRestoreLock = false;

// Saves current standard HTTP/HTTPS URLs to local extension storage
function scheduleTabSave() {
    // Block saving while restoration is in progress to prevent partial saves
    if (isRestoring) return;

    if (debounceTimeout) {
        clearTimeout(debounceTimeout);
    }
    
    // 1.5s debounce to prevent API spam during multiple tab operations
    debounceTimeout = setTimeout(() => {
        // Get only standard browser windows, ignoring PWAs (Spotify, WhatsApp, etc.) and popups
        chrome.windows.getAll({ populate: true, windowTypes: ['normal'] }, (windows) => {
            
            // FIX: If no standard window is open (e.g., closing a PWA), abort saving
            // to prevent overwriting the database with an empty array.
            if (windows.length === 0) return;

            let urls = [];
            
            // Extract URLs from all tabs within standard windows
            windows.forEach(win => {
                win.tabs.forEach(tab => {
                    if (tab.url && tab.url.startsWith('http')) {
                        urls.push(tab.url);
                    }
                });
            });
                
            chrome.storage.local.get(['savedSession'], (result) => {
                const previous = result.savedSession || [];
                
                // Query all tabs to check for race condition on browser startup/crash recovery
                chrome.tabs.query({}, (allTabs) => {
                    if (allTabs.length > 0) {
                        const currentUrl = allTabs[0].url || '';
                        const currentPendingUrl = allTabs[0].pendingUrl || '';

                        // Prevent overwriting the database if Brave starts with a single blank tab
                        if (urls.length === 0 && previous.length > 0 && allTabs.length === 1 && !currentUrl.startsWith('http') && !currentPendingUrl.startsWith('http')) {
                            console.log("Empty startup detected. Preserving saved session.");
                            return;
                        }
                    }
                    
                    // Save snapshot to local SQLite (survives history clearance)
                    chrome.storage.local.set({ savedSession: urls }, () => {
                        console.log("Session saved internally.", urls.length);
                    });
                });
            });
        });
    }, 1500);
}

// Listeners for tab state changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' || changeInfo.url) {
        scheduleTabSave();
    }
});

chrome.tabs.onRemoved.addListener(() => {
    scheduleTabSave();
});

// Manual restore via extension icon click
chrome.action.onClicked.addListener(() => {
    isRestoring = true; 
    
    chrome.storage.local.get(['savedSession'], (result) => {
        const urls = result.savedSession || [];
        
        if (urls.length === 0) {
            isRestoring = false;
            return;
        }

        // Restore all saved URLs in background tabs
        urls.forEach(url => {
            chrome.tabs.create({ url: url, active: false });
        });
        
        // Unblock saving mechanism after tabs are initiated
        setTimeout(() => { isRestoring = false; }, 2000);
    });
});

// Helper function to handle the restoration process
function attemptRestore(targetWindowId, targetTabId, isBlankSystemTab) {
    // 1. IMMEDIATE SYNCHRONOUS LOCK: Prevents parallel execution from onStartup and onCreated.
    // Note: It stays 'true' for the lifetime of the Service Worker, mirroring 'hasRestoredSession'.
    if (memoryRestoreLock) return;
    memoryRestoreLock = true;

    // 2. Asynchronous database lock
    chrome.storage.session.get(['hasRestoredSession'], (sessionResult) => {
        if (sessionResult.hasRestoredSession) return;

        chrome.storage.session.set({ hasRestoredSession: true }, () => {
            isRestoring = true;
            
            chrome.storage.local.get(['savedSession'], (result) => {
                const urls = result.savedSession || [];
                
                if (urls.length === 0) {
                    isRestoring = false;
                    return;
                }

                urls.forEach(savedUrl => {
                    chrome.tabs.create({ windowId: targetWindowId, url: savedUrl, active: false });
                });
                
                if (isBlankSystemTab && targetTabId) {
                    chrome.tabs.remove(targetTabId);
                }
                
                setTimeout(() => { isRestoring = false; }, 2000);
            });
        });
    });
}

// Extracted logic to evaluate if a window qualifies for tab restoration
function evaluateWindowForRestore(winId, tabs) {
    if (tabs.length === 1) {
        const initialTab = tabs[0];
        const url = initialTab.url || '';
        const pendingUrl = initialTab.pendingUrl || '';
        const isBlankSystemTab = !url.startsWith('http') && !pendingUrl.startsWith('http');
        
        attemptRestore(winId, initialTab.id, isBlankSystemTab);
    }
}

// 1. Check windows directly on browser startup
chrome.runtime.onStartup.addListener(() => {
    setTimeout(() => {
        chrome.windows.getAll({ populate: true }, (windows) => {
            const normalWindows = windows.filter(w => w.type === 'normal');
            
            if (normalWindows.length > 0) {
                const win = normalWindows[0];
                evaluateWindowForRestore(win.id, win.tabs || []);
            }
        });
    }, 500);
});

// 2. Listen for window creation (handles PWA opened first, normal browser later)
chrome.windows.onCreated.addListener((win) => {
    if (win.type !== 'normal') return;

    chrome.storage.session.get(['hasRestoredSession'], (sessionResult) => {
        if (sessionResult.hasRestoredSession) return;

        setTimeout(() => {
            chrome.tabs.query({ windowId: win.id }, (tabs) => {
                evaluateWindowForRestore(win.id, tabs);
            });
        }, 500);
    });
});