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
                    if (urls.length === 0 && previous.length > 0 && allTabs.length === 1 && !allTabs[0].url.startsWith('http')) {
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

// Automatic restore on browser startup
chrome.runtime.onStartup.addListener(() => {
    // Short delay (500ms) ensuring UI and tab objects are fully initialized by Chromium
    setTimeout(() => {
        chrome.tabs.query({}, (tabs) => {
            // Check if exactly one non-HTTP tab is open (typical blank new tab on startup)
            if (tabs.length === 1 && (!tabs[0].url || !tabs[0].url.startsWith('http'))) {
                
                isRestoring = true;
                
                chrome.storage.local.get(['savedSession'], (result) => {
                    const urls = result.savedSession || [];
                    
                    if (urls.length === 0) {
                        isRestoring = false;
                        return;
                    }

                    // Restore saved tabs
                    urls.forEach(url => {
                        chrome.tabs.create({ url: url, active: false });
                    });
                    
                    // Remove the initial blank tab for cleaner UI
                    chrome.tabs.remove(tabs[0].id);
                    
                    // Unblock saving mechanism
                    setTimeout(() => { isRestoring = false; }, 2000);
                });
            }
        });
    }, 500);
});