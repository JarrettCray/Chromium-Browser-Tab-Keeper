# Chromium-Browser-Tab-Keeper
Restores tabs after restart when 'Clear browsing data on exit' is enabled in Chromium-based browsers.

A minimalist, privacy-focused Manifest V3 extension that restores tabs when launching Chromium-based browsers (Chrome, Edge, Brave, Vivaldi) configured to clear browsing data on exit.

## The Problem
In Chromium architecture, if you enable **"Clear browsing data on exit"** (specifically Browsing history), the browser physically deletes the local session files upon closing. Consequently, the native "Continue where you left off" setting fails, leaving you with an empty browser on the next startup. 

## The Solution
This extension acts as a local snapshot tool. It bypasses the browser's history database by maintaining an independent array of active standard URLs (HTTP/HTTPS) in the isolated `chrome.storage.local` database. 

### Key Features
* **Zero Tracking:** Everything stays on your machine. No third-party servers, no analytics.
* **PWA Filtering:** Ignores Progressive Web Apps (like Spotify or WhatsApp windowed apps) and popups to prevent them from being restored as standard tabs.
* **Crash & Race-Condition Protection:** Detects empty startups (e.g., after a system crash) and safeguards the local database from being overwritten by a blank tab state.
* **Smart Auto-Restore:** Automatically restores tabs on startup *only* if the browser is launched into a blank New Tab. If you launch the browser via an external link, it respects your action and leaves the saved session intact for manual restoration.

## Installation (Local Deployment)
Since this extension is designed for users who prioritize privacy and do not want to grant global tab-reading permissions to Web Store apps, it is meant to be installed locally:

1. Clone or download this repository to a local folder (e.g., `ChromiumBrowserTabKeeper`).
2. Open your browser's extension page:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Brave: `brave://extensions/`
3. Enable **Developer mode** (toggle in the top right corner).
4. Click **Load unpacked** in the top left corner.
5. Select the `ChromiumBrowserTabKeeper` folder.

## Usage
* The extension works silently in the background. 
* Upon opening the browser normally, tabs will restore automatically.
* You can manually trigger a tab restore at any time by clicking the extension icon.
