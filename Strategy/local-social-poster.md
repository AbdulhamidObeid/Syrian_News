---
name: local-social-poster
description: Execution logic and automation rules for publishing content to multiple social media platforms silently and flawlessly.
---

# 🚀 Local Social Poster: Automation Engine

This document contains the strict rules and guidelines for the Puppeteer automation agent responsible for publishing generated content to Facebook, Instagram, X (Twitter), and TikTok.

## 📐 Rule 1: Platform-Specific Aspect Ratios
The posting agent must dynamically select the correct file based on the platform being targeted. It must never post the wrong dimensions:
- **X (Twitter):** ALWAYS post the 1080x1350 (Portrait) version.
- **Facebook:** ALWAYS post the 1080x1350 (Portrait) version.
- **Instagram:** ALWAYS post the 1080x1350 (Portrait) version.
- **TikTok:** ALWAYS post the 1080x1920 (Vertical/Stories) version.

## 🥷 Rule 2: macOS Popup Bypassing (The Nuclear Intercept)
When automating file uploads in `headless: false` mode (specifically on macOS), native OS File Choosers will block execution or become permanently stuck on the screen if triggered. 

To guarantee a completely silent, popup-free experience, the posting agent MUST follow these exact rules for Facebook and Instagram:
1. **Never Click Visual Buttons:** Do not simulate clicks on visual buttons like "Photo/Video" or "Select from computer" to spawn file dialogs.
2. **Direct Hidden Input Upload:** Always find the hidden `input[type="file"]` natively injected by the platform (e.g., `await page.$$('input[type="file"]')`) and upload directly using `elementHandle.uploadFile()`.
3. **Nuclear Intercept Script:** To prevent the target platform's React/Vue logic from internally triggering a file dialog when it detects an upload, ALWAYS inject a global intercept on the `HTMLInputElement.prototype.click` method using `page.evaluateOnNewDocument` immediately after launching the browser.

### The Nuclear Intercept Snippet:
```javascript
await page.evaluateOnNewDocument(() => {
    const originalClick = window.HTMLInputElement.prototype.click;
    window.HTMLInputElement.prototype.click = function() {
        if (this.type === 'file') {
            console.log('NUCLEAR INTERCEPT: Prevented OS File Chooser from spawning!');
            return; // Do absolutely nothing
        }
        return originalClick.call(this);
    };
    window.showOpenFilePicker = async () => [];
});
```

## 🔒 Rule 3: Single Local Profile Usage
To avoid logging out or triggering suspicious activity blocks, the agent must ALWAYS reuse the local Chrome profile that holds the active sessions.
- **Profile Path:** `--user-data-dir=/Users/obeid/.gemini/antigravity-browser-profile`
- Never run tests in incognito mode or with a temporary profile unless specifically requested for debugging.
- Always check if the profile is currently locked by a crashed background process and forcefully kill it before launching the poster.
