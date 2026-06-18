---
name: local-social-publisher
description: Execution logic and automation rules for publishing content to multiple social media platforms silently and flawlessly.
---

# 🚀 The Publisher: Automation Engine

> **Agent Instruction:** You are the Publisher. Your sole responsibility is taking the final assets and executing the headless or visual automation required to post them to the targeted social platforms.

## 1. Platform-Specific Aspect Ratios
The Publisher must dynamically select the correct file based on the platform being targeted. 
*   **Action:** Read `/Platform_Playbooks/` for the specific network you are targeting to understand what aspect ratio (e.g., Square, Portrait, Vertical) is required for that specific platform.
*   **Action:** If a post requires multiple slides (Carousel format), you must detect this and utilize the platform's multi-image upload feature.

## Known Issues & Workarounds
1. **React/Lexical/Draft.js Captions (Facebook, Instagram, TikTok):** Modern platforms use complex rich-text editors that actively block or drop characters if typed via Puppeteer's standard `page.keyboard.type()`. **DO NOT use `keyboard.type()` for captions!**
   *   **The Fix:** You must construct a synthetic HTML `ClipboardEvent` inside `page.evaluate()` and trigger a native `paste`. Convert newlines into `<div>` or `<br>` before pasting. For TikTok, ensure you use `insertHTML`. (See `poster.js` for the exact reference implementation).
2. **TikTok Pre-filled Filenames:** TikTok automatically injects the uploaded video's filename (e.g. `post_101_tiktok`) into the caption box. 
   *   **The Fix:** You must clear this by programmatically triggering `Meta + A` (Select All) and `Backspace` in Puppeteer *before* pasting the real caption.
3. **Instagram "Discard Post?" Block:** Instagram takes time to upload a post even after clicking "Share". If you navigate away too quickly, it cancels the upload.
   *   **The Fix:** Always inject a static 15-second `delay()` loop after clicking Share, and monitor the page for the success toast ("Your post has been shared") before closing the tab.
4. **Facebook Profile Switching:** Facebook's page switching modal uses nested elements and the blue "Switch" button lacks a standard ID. We must search for `aria-label*="Switch"` broadly and wait at least 15 seconds for the profile context to fully reload.
5. **Facebook Post Button:** The post button says "What's on your mind?" for personal profiles, and "What's on your mind, [Page Name]?" for page profiles. Always match loosely with `.includes("what's on your mind")` or `.includes("بم تفكر")`.
6. **Hashtags:** The Publisher Engine expects the `socialMediaCaption` to be pre-formatted with `#HashSYR24` and `#هاشتاق_سوريا` by the Editor Engine.

## 2. macOS Popup Bypassing (The Nuclear Intercept)
When automating file uploads in `headless: false` mode (specifically on macOS), native OS File Choosers will block execution or become permanently stuck on the screen if triggered. 

To guarantee a completely silent, popup-free experience, the Publisher MUST follow these exact rules for React/Vue-based platforms:
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

## 3. Single Local Profile Usage
To avoid logging out or triggering suspicious activity blocks, the agent must ALWAYS reuse the local Chrome profile that holds the active sessions for the specific brand.
*   Never run tests in incognito mode or with a temporary profile unless specifically requested for debugging.
*   Always check if the profile is currently locked by a crashed background process and forcefully kill it before launching the poster.
