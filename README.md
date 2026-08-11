# Chromium Browser Tab Keeper

A minimalist, privacy-focused Manifest V3 extension that restores tabs when launching Chromium-based browsers configured to clear browsing data on exit. 

**Note: This extension is 100% tested and optimized primarily for the Brave browser.** It is not designed for standard Google Chrome, as Chrome lacks the native feature to completely wipe browsing history upon closing.

## The Problem
In privacy-focused architectures (like Brave or Edge), if you enable **"Clear browsing data on exit"** (specifically Browsing history), the browser physically deletes the local session files upon closing. Consequently, the native "Continue where you left off" setting fails, leaving you with an empty browser on the next startup. 

## The Solution
This extension acts as a local snapshot tool. It bypasses the browser's history database by maintaining an independent array of active standard URLs (HTTP/HTTPS) in the isolated `chrome.storage.local` database. 

### Key Features
* **Brave-First:** Extensively tested to perfectly complement Brave's strict privacy and memory-saving features.
* **Zero Tracking:** Everything stays on your machine. No third-party servers, no analytics.
* **Smart PWA Filtering:** Ignores Progressive Web Apps (like Spotify or WhatsApp windowed apps) and popups to prevent them from being restored as standard tabs.
* **Crash & Race-Condition Protection:** Detects empty startups (e.g., after a system crash) and safeguards the local database from being overwritten by a blank tab state. Handles asynchronous engine quirks flawlessly.
* **Smart Auto-Restore:** Automatically restores tabs on startup *only* if the browser is launched into a blank New Tab. If you launch the browser via an external link (like from an email client), it respects your action and leaves the saved session intact for manual restoration.

## Installation (Local Deployment)
Since this extension is designed for users who prioritize privacy and do not want to grant global tab-reading permissions to Web Store apps, it is meant to be installed locally:

1. Clone or download this repository to a local folder (e.g., `ChromiumBrowserTabKeeper`).
2. Open your browser's extension page:
   - Brave: `brave://extensions/`
   - Edge: `edge://extensions/`
3. Enable **Developer mode** (toggle in the top right corner).
4. Click **Load unpacked** in the top left corner.
5. Select the `ChromiumBrowserTabKeeper` folder.

## Usage
* The extension works silently in the background. 
* Upon opening the browser normally, tabs will restore automatically.
* You can manually trigger a tab restore at any time by clicking the extension icon.