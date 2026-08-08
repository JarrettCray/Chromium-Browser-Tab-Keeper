let debounceTimeout = null;
let isRestoring = false;

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
                    // Prevent overwriting the database if Brave starts with a single blank tab
                    const currentUrl = allTabs[0].url || '';
                    const currentPendingUrl = allTabs[0].pendingUrl || '';

                    if (urls.length === 0 && previous.length > 0 && allTabs.length === 1 && !currentUrl.startsWith('http') && !currentPendingUrl.startsWith('http')) {
                        console.log("Empty startup detected. Preserving saved session.");
                        return;
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
    chrome.storage.session.get(['hasRestoredSession'], (sessionResult) => {
        // Abort if session was already restored during this browser lifecycle
        if (sessionResult.hasRestoredSession) return;

        // Mark session as restored (persists across Service Worker suspends)
        chrome.storage.session.set({ hasRestoredSession: true }, () => {
            isRestoring = true;
            
            chrome.storage.local.get(['savedSession'], (result) => {
                const urls = result.savedSession || [];
                
                if (urls.length === 0) {
                    isRestoring = false;
                    return;
                }

                // Restore saved tabs into the identified normal window
                urls.forEach(savedUrl => {
                    chrome.tabs.create({ windowId: targetWindowId, url: savedUrl, active: false });
                });
                
                // Remove initial tab only if it's a blank system tab
                if (isBlankSystemTab && targetTabId) {
                    chrome.tabs.remove(targetTabId);
                }
                
                // Unblock saving mechanism
                setTimeout(() => { isRestoring = false; }, 2000);
            });
        });
    });
}

// 1. Check windows directly on browser startup
chrome.runtime.onStartup.addListener(() => {
    setTimeout(() => {
        chrome.windows.getAll({ populate: true }, (windows) => {
            // Find if a normal browser window was opened
            const normalWindows = windows.filter(w => w.type === 'normal');
            
            if (normalWindows.length > 0) {
                const win = normalWindows[0];
                const tabs = win.tabs || [];
                let initialTabId = null;
                let isBlankSystemTab = false;

                if (tabs.length === 1) {
                    const initialTab = tabs[0];
                    const url = initialTab.url || '';
                    const pendingUrl = initialTab.pendingUrl || '';
                    isBlankSystemTab = !url.startsWith('http') && !pendingUrl.startsWith('http');
                    initialTabId = initialTab.id;
                }

                attemptRestore(win.id, initialTabId, isBlankSystemTab);
            }
        });
    }, 500);
});

// 2. Listen for window creation (handles PWA opened first, normal browser later)
chrome.windows.onCreated.addListener((win) => {
    if (win.type !== 'normal') return;

    // Pre-check to avoid unnecessary setTimeout if already restored
    chrome.storage.session.get(['hasRestoredSession'], (sessionResult) => {
        if (sessionResult.hasRestoredSession) return;

        // Wait for the new window's initial tab to load
        setTimeout(() => {
            chrome.tabs.query({ windowId: win.id }, (tabs) => {
                let initialTabId = null;
                let isBlankSystemTab = false;

                if (tabs.length === 1) {
                    const initialTab = tabs[0];
                    const url = initialTab.url || '';
                    const pendingUrl = initialTab.pendingUrl || '';
                    isBlankSystemTab = !url.startsWith('http') && !pendingUrl.startsWith('http');
                    initialTabId = initialTab.id;
                }

                attemptRestore(win.id, initialTabId, isBlankSystemTab);
            });
        }, 500);
    });
});