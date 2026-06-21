/**
 * generate_post.js
 * 
 * Dynamic Post Generator for Syrian News (HashSYR24).
 * Reads the Copy Payload JSON, generates/retrieves the image via Higgsfield (browser-based),
 * compiles the template HTML, scales typography dynamically, and screenshots at 1080x1350.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');
const puppeteer = require('puppeteer');

// Load configurations
const brandConfigPath = path.join(__dirname, '../../Config/brand_config.json');
const brandConfig = JSON.parse(fs.readFileSync(brandConfigPath, 'utf8'));

// Default SVG Icons for the icons system
const ICONS = [
    `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
    `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>`,
    `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
    `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>`
];

// Helper to download files
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const protocol = url.startsWith('https') ? https : require('http');
        protocol.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: status ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

/**
 * Automates the browser generation using the open Higgsfield tab
 */
async function generateImageViaBrowser(promptText, referenceImagePath = null, imageModel = 'nano-banana-pro') {
    console.log(`Connecting to running Chrome on 9222 for Higgsfield generation (model: ${imageModel})...`);
    let browser;
    try {
        browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', protocolTimeout: 120000 });
    } catch (e) {
        console.log("Chrome not running on port 9222. Launching it automatically...");
        const { spawn } = require('child_process');
        spawn(brandConfig.browser.chrome_executable || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
            `--remote-debugging-port=${brandConfig.browser.debug_port || 9222}`,
            `--user-data-dir=${brandConfig.browser.profile_path}`
        ], { detached: true, stdio: 'ignore' }).unref();
        
        console.log("Waiting 5 seconds for Chrome to start...");
        await new Promise(r => setTimeout(r, 5000));
        browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', protocolTimeout: 120000 });
    }

    const higgsfieldUrl = `https://higgsfield.ai/ai/image?model=${imageModel}`;

    try {
        const targets = await browser.targets();
        const higgsfieldTarget = targets.find(t => t.type() === 'page' && (t.url().includes('ai/image') || t.url().includes('higgsfield')));
        let page;
        if (!higgsfieldTarget) {
            console.log(`Higgsfield tab not found, creating a new one (model: ${imageModel})...`);
            page = await browser.newPage();
            await page.goto(higgsfieldUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        } else {
            console.log(`Reloading Higgsfield model to ${imageModel} to clear state...`);
            page = await higgsfieldTarget.page();
            await page.goto(higgsfieldUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        }

        console.log(`Connected to: ${page.url()}`);

        // Handle Login Recovery
        const isLoggedOut = await page.evaluate(() => {
            const loginBtn = Array.from(document.querySelectorAll('a, button')).find(b => b.innerText.toLowerCase().includes('login') || b.innerText.toLowerCase().includes('sign in'));
            return !!loginBtn;
        });

        if (isLoggedOut) {
            console.log("Detected logged out state. Attempting auto Google Sign-In recovery...");
            await page.evaluate(() => {
                const loginBtn = Array.from(document.querySelectorAll('a, button')).find(b => b.innerText.toLowerCase().includes('login') || b.innerText.toLowerCase().includes('sign in'));
                if (loginBtn) loginBtn.click();
            });
            await new Promise(r => setTimeout(r, 3000));
            // Click Continue with Google
            await page.evaluate(() => {
                const googleBtn = Array.from(document.querySelectorAll('button, div')).find(b => b.innerText.includes('Continue with Google') || b.innerText.includes('Google'));
                if (googleBtn) googleBtn.click();
            });
            await new Promise(r => setTimeout(r, 5000));
            // In the Chrome profile popup, look for 95dddesigns@gmail.com
            // Note: Since this is OAuth popup, we might not be able to evaluate in it if it's a cross-origin popup.
            // But if it's the same tab redirection:
            const targetsAfter = await browser.targets();
            const authTarget = targetsAfter.find(t => t.type() === 'page' && t.url().includes('accounts.google.com'));
            if (authTarget) {
                console.log("Google Auth page detected. Attempting to select 95dddesigns@gmail.com");
                const authPage = await authTarget.page();
                await authPage.evaluate(() => {
                    const accounts = Array.from(document.querySelectorAll('div[data-identifier]'));
                    const target = accounts.find(a => a.getAttribute('data-identifier') === '95dddesigns@gmail.com');
                    if (target) { target.click(); }
                    else {
                        // Just click the first account if we can't find it by identifier
                        const firstAcc = document.querySelector('div.WBhXh');
                        if (firstAcc) firstAcc.click();
                    }
                });
                // Wait for navigation back to higgsfield
                await new Promise(r => setTimeout(r, 10000));
            } else {
                console.log("No Google Auth page detected, assuming auto-redirect works.");
                await new Promise(r => setTimeout(r, 5000));
            }
            
            // Go back to the image generation url to ensure we're on the right page
            await page.goto('https://higgsfield.ai/ai/image?model=nano-banana-pro', { waitUntil: 'domcontentloaded', timeout: 60000 });
        }

        // Wait for past history images to load (if any) to prevent race conditions
        try {
            await page.waitForSelector('img[alt="image generation"]', { timeout: 3000 });
        } catch (e) {}

        // 1. Get the current first generated image src
        const firstImageBefore = await page.evaluate(() => {
            const firstImg = document.querySelector('img[alt="image generation"]');
            return firstImg ? firstImg.src : null;
        });
        
        let beforeUuid = null;
        if (firstImageBefore) {
            const match = firstImageBefore.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
            if (match) beforeUuid = match[0];
        }
        console.log(`First image before submit: ${firstImageBefore} | UUID: ${beforeUuid}`);

        // 2. Enter prompt
        console.log("Setting generation prompt...");
        
        // Ensure prompt area is ready
        await page.waitForSelector('#hf\\:tour-image-prompt');
        
        // Focus, clear existing text, and type new text mimicking real user
        await page.click('#hf\\:tour-image-prompt');
        
        // Select all text and delete it
        await page.keyboard.down('Meta');
        await page.keyboard.press('a');
        await page.keyboard.up('Meta');
        await page.keyboard.press('Backspace');
        
        // Fallback clear if Meta+A fails
        await page.evaluate(() => {
            const el = document.getElementById('hf:tour-image-prompt');
            if (el) {
                if (el.value !== undefined) el.value = '';
                else el.innerText = '';
                el.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });

        // Type the prompt string directly using the keyboard
        await page.keyboard.type(promptText, { delay: 10 });
        await new Promise(r => setTimeout(r, 1000));


        // 2. Upload reference image if strategy is 'reference'
        // DISABLED BY ADMIN: Reference images were causing distorted "wrong" outputs.
        // We now rely entirely on the text prompt.
        if (referenceImagePath) {
            console.log(`[DISABLED] Skipping reference image upload: ${referenceImagePath}`);
        }

        // 4. Ensure Unlimited Toggle is ON
        await page.evaluate(() => {
            const toggle = document.querySelector('button[role="switch"]');
            if (toggle) {
                const checked = toggle.getAttribute('aria-checked') === 'true' || toggle.classList.contains('bg-separator-success');
                if (!checked) {
                    toggle.click();
                    console.log("Unlimited toggle turned ON.");
                }
            }
        });

        // 5. Ensure aspect ratio is set correctly for the chosen model:
        //    nano-banana-pro → 5:4  |  flux-2-pro → 4:3 (FLUX doesn't support 5:4)
        const targetRatio = imageModel === 'flux-2-pro' ? '4:3' : '5:4';
        await page.evaluate((ratio) => {
            const buttons = Array.from(document.querySelectorAll('button'));
            // Find the active aspect ratio button (shows the current selection)
            const arButton = buttons.find(b =>
                b.innerText.includes('5:4') || b.innerText.includes('4:5') ||
                b.innerText.includes('4:3') || b.innerText.includes('1:1') ||
                b.innerText.includes('16:9') || b.innerText.includes('9:16')
            );
            if (arButton && !arButton.innerText.includes(ratio)) {
                arButton.click();
                setTimeout(() => {
                    const items = Array.from(document.querySelectorAll('div, button, li'));
                    const target = items.find(el => el.innerText.trim() === ratio);
                    if (target) target.click();
                }, 500);
            }
        }, targetRatio);
        await new Promise(r => setTimeout(r, 1000));

        // 6. Ensure resolution is set to 2K
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const resButton = buttons.find(b => b.innerText.includes('2K') || b.innerText.includes('1K') || b.innerText.includes('4K'));
            if (resButton && !resButton.innerText.includes('2K')) {
                resButton.click();
                setTimeout(() => {
                    const items = Array.from(document.querySelectorAll('div, button, li'));
                    const item2k = items.find(el => el.innerText.trim() === '2K');
                    if (item2k) item2k.click();
                }, 500);
            }
        });
        await new Promise(r => setTimeout(r, 1000));

        // 7. Click submit
        console.log("Clicking Unlimited submit button...");
        const clickSuccess = await page.evaluate(() => {
            const submitBtn = document.getElementById('hf:image-form-submit');
            if (submitBtn) {
                submitBtn.focus();
                submitBtn.click();
                return true;
            }
            return false;
        });

        if (!clickSuccess) {
            throw new Error("Submit button '#hf:image-form-submit' not found!");
        }

        // Wait for 5 seconds before we even start polling to let the UI react
        await new Promise(r => setTimeout(r, 5000));

        // 8. Poll for new image
        let newImageUrl = null;
        let attempts = 0;
        const maxAttempts = 120; // 120 * 3 seconds = 360 seconds (6 minutes) max waiting time

        while (!newImageUrl && attempts < maxAttempts) {
            attempts++;
            await new Promise(r => setTimeout(r, 3000));
            newImageUrl = await page.evaluate((beforeUuidStr, beforeSrc) => {
                const firstImg = document.querySelector('img[alt="image generation"]');
                if (firstImg && firstImg.src) {
                    const src = firstImg.src;
                    
                    // If it's literally the exact same string, ignore
                    if (src === beforeSrc) return null;

                    // Ensure it's not a loading spinner or placeholder URL
                    if (src.includes('loader') || src.includes('loading') || src.includes('placeholder')) {
                        return null;
                    }
                    
                    if (src.includes('cloudfront.net') || src.includes('higgs.ai')) {
                        // Check UUID
                        const match = src.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
                        if (match) {
                            if (match[0] !== beforeUuidStr) {
                                return src;
                            }
                        } else if (src !== beforeSrc) {
                            // fallback if no uuid found but string changed completely
                            return src;
                        }
                    }
                }
                return null;
            }, beforeUuid, firstImageBefore);
        }

        if (!newImageUrl) {
            throw new Error("Image generation timed out in browser polling after 6 minutes.");
        }

        // Extract clean CloudFront URL from proxy URL if applicable
        let cleanUrl = newImageUrl;
        if (newImageUrl.includes('url=')) {
            const match = newImageUrl.match(/url=([^&]+)/);
            if (match) {
                cleanUrl = decodeURIComponent(match[1]);
            }
        }

        console.log(`Successfully generated new image in browser: ${cleanUrl}`);

        // 🧹 Cleanup: Remove reference image from Higgsfield UI so it doesn't bleed into next run
        if (referenceImagePath) {
            try {
                await page.evaluate(() => {
                    // Try various selectors Higgsfield uses for the reference image remove button
                    const selectors = [
                        'button[aria-label="Remove image"]',
                        'button[aria-label="remove"]',
                        '[data-testid="remove-reference"]',
                        'button.remove-reference',
                    ];
                    for (const sel of selectors) {
                        const btn = document.querySelector(sel);
                        if (btn) { btn.click(); return true; }
                    }
                    // Fallback: look for any × button near the reference image preview
                    const allButtons = Array.from(document.querySelectorAll('button'));
                    const removeBtn = allButtons.find(b =>
                        (b.innerText === '×' || b.innerText === 'x' || b.getAttribute('aria-label')?.toLowerCase().includes('remov')) &&
                        b.closest('[id*="reference"], [class*="reference"], [class*="upload"]')
                    );
                    if (removeBtn) { removeBtn.click(); return true; }
                    return false;
                });
                await new Promise(r => setTimeout(r, 800));
                console.log('✅ Reference image removed from Higgsfield UI.');
            } catch (cleanupErr) {
                console.warn(`⚠️ Could not auto-remove reference image from UI: ${cleanupErr.message}`);
            }
        }

        return cleanUrl;

    } finally {
        browser.disconnect();
    }
}

/**
 * Main function to generate the post image
 */
async function generateSinglePost(payloadPath, outputDir = null, payloadObj = null, slideIndex = null) {
    if (!fs.existsSync(payloadPath)) {
        console.error(`❌ Payload file not found at ${payloadPath}`);
        return;
    }

    const payload = payloadObj || JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
    console.log(`\n==========================================================`);
    console.log(`Processing Single Image: ${payload.subHeadline} - ${payload.headline ? payload.headline.line1 : 'Slide'}`);
    console.log(`==========================================================`);

    const tempDir = path.join(__dirname, 'temp_run');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    const postId = path.basename(payloadPath, '.json').replace('post_', '');
    
    // Handle Image Prompt Location (Carousel vs Single Post)
    if (payload.isCarousel && payload.slides && payload.slides[0] && payload.slides[0].imagePrompt) {
        payload.imagePrompt = payload.slides[0].imagePrompt;
        if (!payload.imageStrategy) {
            payload.imageStrategy = 'generate';
        }
    }
    
    const localMainImagePath = path.join(tempDir, `main_image_${postId}.jpg`);
        
    let imageSuccess = false;

    // Phase 1: Retrieve main image
    if (fs.existsSync(localMainImagePath)) {
        console.log(`Main image already exists for this post: ${localMainImagePath}. Skipping generation/download.`);
        imageSuccess = true;
    } else {
        if (payload.imageStrategy === 'generate' || payload.imageStrategy === 'reference') {
            let referenceLocalPath = null;
            
            if (payload.imageStrategy === 'reference' && payload.imageUrl) {
                referenceLocalPath = path.join(tempDir, `ref_image_${postId}.jpg`);
                console.log(`Downloading original reference image: ${payload.imageUrl}`);
                try {
                    await downloadFile(payload.imageUrl, referenceLocalPath);
                    console.log("Reference image downloaded successfully.");
                } catch (err) {
                    console.warn(`⚠️ Warning: Failed to download reference image: ${err.message}. Generating without reference...`);
                    referenceLocalPath = null;
                }
            }

            try {
                let generatedUrl = null;
                let currentAttempt = 0;
                const maxRetries = 3;

                while (!generatedUrl && currentAttempt < maxRetries) {
                    currentAttempt++;
                    console.log(`\n--- Higgsfield Generation Attempt ${currentAttempt}/${maxRetries} (model: ${payload.imageModel || 'nano-banana-pro'}) ---`);
                    try {
                        generatedUrl = await generateImageViaBrowser(payload.imagePrompt, referenceLocalPath, payload.imageModel || 'nano-banana-pro');
                    } catch (browserError) {
                        console.error(`Attempt ${currentAttempt} failed: ${browserError.message}`);
                        if (currentAttempt === maxRetries) {
                            throw new Error(`Failed to generate image after ${maxRetries} attempts.`);
                        }
                        console.log("Waiting 10 seconds before retrying...");
                        await new Promise(r => setTimeout(r, 10000));
                    }
                }

                console.log(`Downloading generated image from cloudfront: ${generatedUrl}`);
                await downloadFile(generatedUrl, localMainImagePath);
                imageSuccess = true;
            } catch (e) {
                console.error(`❌ Higgsfield browser generation fully failed: ${e.message}`);
                // Instead of falling back, we throw an error so the Orchestrator can alert Telegram
                throw new Error(`Higgsfield browser generation failed: ${e.message}`);
            }
        }

        // Fallback ONLY if strategy was NOT generate
        if (!imageSuccess && payload.imageStrategy !== 'generate') {
            console.log(`Using original image url: ${payload.imageUrl}`);
            try {
                await downloadFile(payload.imageUrl, localMainImagePath);
                imageSuccess = true;
            } catch (err) {
                console.error(`❌ Failed to download original image: ${err.message}`);
                throw new Error(`Failed to download fallback image: ${err.message}`);
            }
        } else if (!imageSuccess) {
             throw new Error(`Image generation failed and strategy was set to generate. No fallback allowed.`);
        }
    }

    // Phase 2: Template Compilation
    let templateName = `1080x1350_${payload.contentType}`;
    
    // Override template if it is a Carousel slide
    if (payload.type === 'hook') {
        templateName = 'Carousel_Hook';
    } else if (payload.type === 'body') {
        templateName = 'Carousel_Body';
    } else if (payload.type === 'cta') {
        templateName = 'Carousel_CTA';
    }

    const templateHtmlPath = path.join(__dirname, 'templates', `${templateName}.html`);
    if (!fs.existsSync(templateHtmlPath)) {
        throw new Error(`Template not found: ${templateHtmlPath}.`);
    }

    let templateHtml = fs.readFileSync(templateHtmlPath, 'utf8');

    // Determine Bullet System and Layout Archetype
    const bulletSystem = payload.bulletSystem || 'dots';
    payload.points = payload.points || [];
    const pointCount = payload.points.length;
    let layoutType = payload.layoutType;

    if (!layoutType) {
        if (pointCount === 1) layoutType = '1-box';
        else if (pointCount === 2) layoutType = '2-stack';
        else if (pointCount === 3) layoutType = '3-stack';
        else if (pointCount === 4) layoutType = '4-grid';
    }

    console.log(`Layout Type: ${layoutType} | Bullet System: ${bulletSystem}`);

    // Load base64 bullet template
    const match = templateHtml.match(new RegExp(`<meta id="bullet-template-${bulletSystem}" content="(.*?)">`));
    if (!match) {
        throw new Error(`Metadata bullet template 'bullet-template-${bulletSystem}' not found in template!`);
    }

    const bulletTemplateStr = Buffer.from(match[1], 'base64').toString('utf8');
    const gapClass = (layoutType === '2-side' || layoutType === '4-grid') ? 'gap-3' : 'gap-4';

    const renderBullet = (index, text, cols = "") => {
        const separatorRegex = /(?:<br\s*\/?>|\n)+/gi;
        const paragraphs = (text || '').split(separatorRegex).filter(p => p.trim() !== '');
        
        let boldedParagraphs = paragraphs;
        
        const isCarouselSlide = ['hook', 'body', 'cta'].includes(payload.type);
        const isDarkBg = !isCarouselSlide && ['urgent', 'green', 'black'].includes(payload.contentType);
        const boldClass = isDarkBg ? 'text-white' : 'text-slate-950';
        const textColorClass = isDarkBg ? 'text-white' : 'text-slate-900';

        if (payload.type !== 'cta') {
            boldedParagraphs = paragraphs.map(p => {
                const words = p.trim().split(/\s+/);
                if (words.length >= 2) {
                    const boldPart = words.slice(0, 2).join(' ');
                    const restPart = words.slice(2).join(' ');
                    return `<span class="font-bold ${boldClass}">${boldPart}</span> ${restPart}`;
                } else if (words.length === 1) {
                    return `<span class="font-bold ${boldClass}">${words[0]}</span>`;
                }
                return p;
            });
        }

        const gapDiv = layoutType === '1-box' ? `</div><div class="h-6 w-full"></div><div class="bullet-text w-full ${textColorClass} leading-[1.6] text-center font-medium" dir="rtl">` : '<br>';

        let html = bulletTemplateStr
            .replace(/__BULLET_INDEX__/g, (index + 1).toString().padStart(2, '0'))
            .replace(/__BULLET_TEXT__/g, boldedParagraphs.join(gapDiv));
        if (bulletSystem === 'icons') {
            html = html.replace('__BULLET_ICON__', ICONS[index % ICONS.length]);
        }
        if (cols) {
            html = html.replace('class="', `class="${cols} `);
        }

        // Apply visual styling modifications
        if (bulletSystem === 'dots') {
            // Rule: For dots, remove dot, center text, bold first 2 words in: 2-stack, 2-side, 3-mixed-top, 3-mixed-bottom
            if (['2-stack', '2-side', '3-mixed-top', '3-mixed-bottom'].includes(layoutType)) {
                html = html.replace(/<div class="w-3 h-3.*><\/div>/, ''); // Remove dot
                html = html.replace('text-right', 'text-center').replace('justify-start', 'justify-center').replace('items-start', 'items-center');
                
                // Bold first 2 words
                const words = text.split(' ');
                if (words.length >= 2) {
                    const modifiedText = `<span class="font-bold">${words.slice(0, 2).join(' ')}</span> ${words.slice(2).join(' ')}`;
                    html = html.replace(text, modifiedText);
                }
            }

            // Rule: Center green dots vertically for 3-stack and 4-grid layouts
            if (['3-stack', '4-grid'].includes(layoutType)) {
                html = html.replace('items-start', 'items-center');
                html = html.replace('mt-2.5', '');
            }
        }

        return html;
    };

    let bulletsHtml = '';
    let containerClasses = '';

    if (layoutType === '1-box') {
        containerClasses = `flex flex-col ${gapClass} w-full`;
        bulletsHtml = renderBullet(0, payload.points[0]);
        // Remove dot/num and center
        bulletsHtml = bulletsHtml.replace(/<div class="w-3 h-3.*><\/div>/, '');
        bulletsHtml = bulletsHtml.replace('text-right', 'text-center').replace('justify-start', 'justify-center').replace('items-start', 'items-center');
    } else if (layoutType === '2-stack') {
        containerClasses = `flex flex-col ${gapClass} w-full min-w-0`;
        bulletsHtml = renderBullet(0, payload.points[0]) + renderBullet(1, payload.points[1]);
    } else if (layoutType === '2-side') {
        containerClasses = `grid grid-cols-2 ${gapClass} w-full h-full min-w-0`;
        bulletsHtml = renderBullet(0, payload.points[0]) + renderBullet(1, payload.points[1]);
    } else if (layoutType === '3-stack') {
        containerClasses = `flex flex-col ${gapClass} w-full min-w-0`;
        bulletsHtml = renderBullet(0, payload.points[0]) + renderBullet(1, payload.points[1]) + renderBullet(2, payload.points[2]);
    } else if (layoutType === '3-mixed-top') {
        containerClasses = `grid grid-cols-2 ${gapClass} w-full h-full min-w-0`;
        bulletsHtml = renderBullet(0, payload.points[0], "col-span-2") + 
                      renderBullet(1, payload.points[1]) + renderBullet(2, payload.points[2]);
    } else if (layoutType === '3-mixed-bottom') {
        containerClasses = `grid grid-cols-2 ${gapClass} w-full h-full min-w-0`;
        bulletsHtml = renderBullet(0, payload.points[0]) + renderBullet(1, payload.points[1]) + 
                      renderBullet(2, payload.points[2], "col-span-2");
    } else if (layoutType === '4-grid') {
        containerClasses = `grid grid-cols-2 grid-rows-2 ${gapClass} w-full h-full min-w-0`;
        bulletsHtml = renderBullet(0, payload.points[0]) + renderBullet(1, payload.points[1]) + 
                      renderBullet(2, payload.points[2]) + renderBullet(3, payload.points[3]);
    }

    bulletsHtml = `<div id="grid-container" class="${containerClasses}">${bulletsHtml}</div>`;

    // Construct headline HTML based on style
    let formattedHeadline = '';
    const fixWidow = (text) => {
        if (!text) return '';
        const lastSpace = text.trim().lastIndexOf(' ');
        if (lastSpace === -1) return text;
        return text.substring(0, lastSpace) + '&nbsp;' + text.substring(lastSpace + 1);
    };

    if (!payload.headline) {
        formattedHeadline = '';
    } else if (payload.headlineStyle === 'T1' || !payload.headline.line2) {
        formattedHeadline = `<span class="font-bold">${fixWidow(payload.headline.line1)}</span>`;
    } else {
        formattedHeadline = `<span class="font-semibold">${fixWidow(payload.headline.line1)}</span><br/><span class="font-bold">${fixWidow(payload.headline.line2)}</span>`;
    }

    // Build final HTML
    let finalHtml = templateHtml
        .replace(/__SUB_HEADLINE__/g, payload.subHeadline)
        .replace(/__MAIN_IMAGE_URL__/g, `file://${localMainImagePath}`)
        .replace(/__BULLETS_HTML__/g, bulletsHtml)
        .replace(/__MAIN_HEADLINE__/g, formattedHeadline);

    if (payload.type === 'hook') {
        finalHtml = finalHtml.replace(/__HEADLINE_CLASSES__/g, 'text-[75px]');
    } else {
        finalHtml = finalHtml.replace(/__HEADLINE_CLASSES__/g, 'text-[60px]');
    }

    const renderedHtmlPath = path.join(tempDir, `rendered_post_${postId}.html`);
    fs.writeFileSync(renderedHtmlPath, finalHtml);

    // Phase 3: Puppeteer Render & Scaling
    console.log("Launching headless browser for screenshot rendering...");
    const browser = await puppeteer.launch({ headless: 'new' });
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
        await page.goto(`file://${renderedHtmlPath}`, { waitUntil: 'networkidle0' });

        // Wait for fonts to load
        await page.evaluateHandle('document.fonts.ready');
        await new Promise(r => setTimeout(r, 500));

        const slideType = payload.type || 'hook';

        // Execute dynamic scaling and fit algorithm
        const validation = await page.evaluate(({ layoutType, slideType }) => {
            // For 4-grid, increase bento container max height to 48% (if hook slide)
            if (layoutType === '4-grid' && slideType === 'hook') {
                const bento = document.getElementById('bento-container');
                if (bento) bento.style.maxHeight = '48%';
            }

            // Headline scaling: shrink if height > 2.5 lines limit
            const headlineEl = document.getElementById('main-headline');
            if (headlineEl) {
                const lineHeight = parseInt(window.getComputedStyle(headlineEl).lineHeight);
                let fontSize = 60; // default text-[60px]
                headlineEl.style.fontSize = fontSize + 'px';
                while (headlineEl.offsetHeight > lineHeight * 2.5 && fontSize > 36) {
                    fontSize -= 2;
                    headlineEl.style.fontSize = fontSize + 'px';
                }
            }

            // Bento font sizes rules
            let defaultFontSize = 28;
            let absoluteMinSize = 26;
            if (layoutType === '1-box') {
                defaultFontSize = 50; // Start huge and let it shrink to perfectly fit 85-90%
                absoluteMinSize = 26;
            } else if (layoutType === '2-stack') {
                defaultFontSize = 34;
                absoluteMinSize = 26;
            } else if (layoutType === '2-side') {
                defaultFontSize = 24;
                absoluteMinSize = 16;
            } else if (layoutType === '3-stack') {
                defaultFontSize = 28;
                absoluteMinSize = 26;
            } else if (layoutType === '3-mixed-top' || layoutType === '3-mixed-bottom') {
                defaultFontSize = 24;
                absoluteMinSize = 16;
            } else if (layoutType === '4-grid') {
                defaultFontSize = 24;
                absoluteMinSize = 16;
            }

            const bulletTexts = Array.from(document.querySelectorAll('.bullet-text'));
            const bentoParent = document.getElementById('bento-container');
            const textContainer = document.getElementById('grid-container');

            let currentSize = defaultFontSize;
            let overflowed = false;

            if (bentoParent && textContainer) {
                // Set to default first
                bulletTexts.forEach(el => el.style.fontSize = defaultFontSize + 'px');

                const MAX_HEIGHT = 970;
                // Shrink dynamically if it overflows vertically
                while (textContainer.scrollHeight > MAX_HEIGHT && currentSize > absoluteMinSize) {
                    currentSize--;
                    bulletTexts.forEach(el => el.style.fontSize = currentSize + 'px');
                }
                overflowed = textContainer.scrollHeight > MAX_HEIGHT;
            }
            return {
                success: !overflowed,
                finalFontSize: currentSize,
                overflowed: overflowed
            };
        }, { layoutType, slideType });

        console.log(`Validation details: Font Size: ${validation.finalFontSize}px | Succeeded: ${validation.success}`);
        if (validation.overflowed) {
            console.warn("⚠️ Warning: Bento layout text overflowed the safe zone container!");
        }

        // Save screenshot
        const finalOutputDir = outputDir || path.join(__dirname, 'output');
        if (!fs.existsSync(finalOutputDir)) fs.mkdirSync(finalOutputDir, { recursive: true });

        const finalOutputPath = slideIndex !== null 
            ? path.join(finalOutputDir, `post_${postId}_${slideIndex}.png`) 
            : path.join(finalOutputDir, `post_${postId}.png`);
            
        await page.screenshot({ path: finalOutputPath });
        console.log(`\n🎉 Success! Final post image rendered to: ${finalOutputPath}`);
        
        return finalOutputPath;

    } finally {
        await browser.close();
        
        // Note: we no longer delete the main_image or rendered_html to keep them for inspection
        // and because they are only deleted when published. We just clean the ref image if it exists.
        try {
            const refPath = path.join(tempDir, `ref_image_${postId}.jpg`);
            if (fs.existsSync(refPath)) fs.unlinkSync(refPath);
        } catch (e) {
            // silent ignore
        }
    }
}

/**
 * Wrapper to handle Carousel Arrays and Single Posts
 */
async function generatePost(payloadPath, outputDir = null) {
    if (!fs.existsSync(payloadPath)) {
        console.error(`❌ Payload file not found at ${payloadPath}`);
        return null;
    }

    const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));

    if (payload.isCarousel && payload.slides && payload.slides.length > 0) {
        console.log(`\n==========================================================`);
        console.log(`🎠 Processing Carousel Post: ${payload.slides.length} slides`);
        console.log(`==========================================================`);
        
        const outputPaths = [];
        for (let i = 0; i < payload.slides.length; i++) {
            const slide = payload.slides[i];
            
            // Format slide payload to look like a normal payload for generateSinglePost
            const slidePayload = {
                ...payload,
                type: slide.type, // Pass the type here so it picks the correct Carousel template
                headline: slide.headline || null,
                points: slide.points || [],
                layoutType: '1-box', // Carousels ALWAYS use 1-box layout, never 2-stack
                imagePrompt: slide.imagePrompt || null,
            };
            
            // Remove the slides array so generateSinglePost doesn't get confused and override the prompt
            delete slidePayload.slides;

            // If CTA, force 1-box and make points contain ctaText
            if (slide.type === 'cta') {
                slidePayload.layoutType = '1-box';
                slidePayload.points = [slide.ctaText || "تابعنا للمزيد من التحليلات"];
                if (!slidePayload.headline) slidePayload.headline = { line1: "انضم إلينا!" };
            }

            console.log(`\n--- Generating Carousel Slide ${i + 1}/${payload.slides.length} ---`);
            const outputPath = await generateSinglePost(payloadPath, outputDir, slidePayload, i + 1);
            if (outputPath) outputPaths.push(outputPath);
        }
        return outputPaths; // Returns array of paths
    } else {
        const outputPath = await generateSinglePost(payloadPath, outputDir);
        return outputPath ? [outputPath] : []; // Standardize return as an array
    }
}

// CLI / Test Execution Block
if (require.main === module) {
    const args = process.argv.slice(2);
    const inputArg = args.find(a => a.startsWith('--input='));
    const inputPath = inputArg ? inputArg.split('=')[1] : (args[0] || path.join(__dirname, 'copy_input/post_101.json'));
    
    generatePost(inputPath)
        .then(() => console.log("\nPost Generation Complete."))
        .catch(console.error);
}

module.exports = {
    generatePost
};
