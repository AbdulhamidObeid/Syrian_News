# Higgsfield Browser-Based Unlimited Image Generation Guide

This guide details how to automate free, unlimited image generations on Higgsfield AI by attaching to an active, pre-authenticated user Chrome session on port `9222`. This method bypasses API credit deductions by simulating human interactions on the web UI while the "Unlimited" toggle is enabled.

---

## 1. Browser Environment Setup

To allow agents to connect to your browser session:
1. Launch Google Chrome with remote debugging enabled:
   ```bash
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir="/Users/obeid/.gemini/antigravity-browser-profile"
   ```
2. Navigate to `https://higgsfield.ai/ai/image?model=nano-banana-pro` and make sure your Gmail/Higgsfield account is logged in.
3. Configure your desired default settings in the bottom bar (e.g., model: **Nano Banana Pro**, Aspect Ratio: **4:5** or **4:3**, Resolution: **2K**, and **Unlimited Toggle ON**).

---

## 2. Technical Automation Details

### DOM Element Selectors
* **Prompt Input Box:** `div#hf:tour-image-prompt` (a contenteditable `div` rather than a standard textarea/input).
* **Reference Image Upload:** `input#image-form-reference` (a hidden `input[type="file"]` element).
* **Unlimited Switch Toggle:** `button[role="switch"]` (active when class `bg-separator-success` is present or `aria-checked="true"`).
* **Submit Action Button:** `button#hf:image-form-submit` (displays "Unlimited" text when the toggle is ON).
* **Generated Image Cards:** `img[alt="image generation"]` (appended to the top of the feed grid, sorted newest-first).

---

## 3. Automation Code Reference (Node.js & Puppeteer)

Use the following pattern inside any automation script:

```javascript
const puppeteer = require('puppeteer');

async function generateImage(promptText, localReferencePath = null) {
    // Connect to the active Chrome instance
    const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
    try {
        const pages = await browser.pages();
        const page = pages.find(p => p.url().includes('ai/image'));
        if (!page) throw new Error("Higgsfield tab not found on port 9222!");

        // 1. Record the current newest image URL to avoid false positives
        const newestBefore = await page.evaluate(() => {
            const img = document.querySelector('img[alt="image generation"]');
            return img ? img.src : null;
        });

        // 2. Set prompt with React compatibility
        await page.evaluate((text) => {
            const inputDiv = document.getElementById('hf:tour-image-prompt');
            if (!inputDiv) throw new Error("Prompt editor input not found!");
            inputDiv.focus();
            inputDiv.innerText = text;
            // React listens to input events for state sync
            inputDiv.dispatchEvent(new Event('input', { bubbles: true }));
        }, promptText);

        // 3. Upload Reference Image (optional)
        if (localReferencePath) {
            const fileInput = await page.$('#image-form-reference');
            if (fileInput) {
                await fileInput.uploadFile(localReferencePath);
                await new Promise(r => setTimeout(r, 1500)); // wait for upload attachment
            }
        }

        // 4. Ensure Unlimited Toggle is active
        await page.evaluate(() => {
            const toggle = document.querySelector('button[role="switch"]');
            if (toggle) {
                const checked = toggle.getAttribute('aria-checked') === 'true' || toggle.classList.contains('bg-separator-success');
                if (!checked) toggle.click();
            }
        });

        // 5. Submit Generation
        const clicked = await page.evaluate(() => {
            const btn = document.getElementById('hf:image-form-submit');
            if (btn) {
                btn.focus();
                btn.click();
                return true;
            }
            return false;
        });
        if (!clicked) throw new Error("Submit button '#hf:image-form-submit' not found!");

        // 6. Poll for the brand new card to complete loading
        let newUrl = null;
        let attempts = 0;
        while (!newUrl && attempts < 60) {
            attempts++;
            await new Promise(r => setTimeout(r, 3000));
            newUrl = await page.evaluate((beforeSrc) => {
                const img = document.querySelector('img[alt="image generation"]');
                if (img && img.src && img.src !== beforeSrc) {
                    const src = img.src;
                    if (src.includes('cloudfront.net') || src.includes('higgs.ai')) {
                        // Ensure it's not a loading spinner or skeleton
                        if (!src.includes('loader') && !src.includes('loading') && !src.includes('placeholder')) {
                            return src;
                        }
                    }
                }
                return null;
            }, newestBefore);
        }

        if (!newUrl) throw new Error("Image generation timed out.");

        // Extract clean CloudFront URL (bypass higgs.ai resize proxy if necessary)
        let cleanUrl = newUrl;
        if (newUrl.includes('url=')) {
            const match = newUrl.match(/url=([^&]+)/);
            if (match) cleanUrl = decodeURIComponent(match[1]);
        }

        return cleanUrl;
    } finally {
        browser.disconnect();
    }
}
```

---

## 4. Troubleshooting Connection Loss

If the connection to Chrome is lost:
1. **Check Chrome Process**: Ensure Chrome is running and port `9222` is active. You can verify this by running:
   ```bash
   lsof -i :9222
   ```
2. **Verify Port in Settings**: If another app is using port 9222, close it or terminate the orphaned Chrome processes:
   ```bash
   pkill -f "Google Chrome"
   ```
3. **Re-launch Chrome**: Re-run the launch command under Section 1.
4. **Inspect Tab**: Ensure the Higgsfield `ai/image` tab is actively selected or open in Chrome.
