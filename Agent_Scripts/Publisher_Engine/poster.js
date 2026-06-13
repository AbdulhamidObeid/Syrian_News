const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    const imagePath = process.argv[2];
    let caption = process.argv[3];
    caption = caption.replace(/\\n/g, '\n');

    if (!imagePath || !caption) {
        console.error('Usage: node poster.js <image_path> "<caption text>"');
        process.exit(1);
    }

    if (!fs.existsSync(imagePath)) {
        console.error(`Error: Image file not found at ${imagePath}`);
        process.exit(1);
    }

    const path = require('path');
    const os = require('os');
    const profilePath = path.join(os.homedir(), '.gemini', 'antigravity-browser-profile');
    console.log(`Launching Google Chrome with profile at: ${profilePath}`);
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: false,
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            userDataDir: profilePath,
            defaultViewport: null,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized']
        });
        console.log('✅ Launched browser!');
    
    // NUCLEAR OPTION to prevent OS File Choosers from ever spawning on macOS
    await browser.on('targetcreated', async (target) => {
        if (target.type() === 'page') {
            const newPage = await target.page();
            if (newPage) {
                await newPage.evaluateOnNewDocument(() => {
                    const originalClick = window.HTMLInputElement.prototype.click;
                    window.HTMLInputElement.prototype.click = function() {
                        if (this.type === 'file') {
                            console.log('NUCLEAR INTERCEPT: Prevented OS File Chooser from spawning!');
                            return; // Do absolutely nothing
                        }
                        return originalClick.call(this);
                    };
                    
                    // Also intercept showOpenFilePicker just in case
                    window.showOpenFilePicker = async () => {
                        console.log('NUCLEAR INTERCEPT: Prevented showOpenFilePicker!');
                        return [];
                    };
                });
            }
        }
    });

    } catch (e) {
        throw new Error('❌ Failed to launch browser: ' + e.message);
    }

    const pages = await browser.pages();

    // 1. POST TO X (TWITTER)
    try {
        console.log('\n--- Posting to X (Twitter) ---');
        let xPage = pages.find(p => p.url().includes('x.com')) || await browser.newPage();
        await xPage.bringToFront();
        await xPage.goto('https://x.com/compose/post', { waitUntil: 'networkidle2' });
        await delay(4000);

        const fileInput = await xPage.waitForSelector('input[data-testid="fileInput"]', { timeout: 5000 });
        await fileInput.uploadFile(imagePath);
        console.log('✅ X Image uploaded');
        await delay(3000);

        await xPage.type('[data-testid="tweetTextarea_0"]', caption);
        console.log('✅ X Caption typed');
        await delay(2000);

        const clickedXPost = await xPage.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button[data-testid="tweetButton"]'));
            const visibleBtn = btns.find(b => b.offsetParent !== null);
            if (visibleBtn && !visibleBtn.disabled) {
                visibleBtn.click();
                return true;
            }
            return false;
        });
        
        if (clickedXPost) console.log('✅ X Post submitted');
        else throw new Error('Could not find visible X Post button');
        await delay(4000);
    } catch (e) {
        console.error('❌ Failed on X:', e.message);
    }

    // 2. POST TO FACEBOOK PAGE
    try {
        console.log('\n--- Posting to Facebook Page ---');
        let fbPage = pages.find(p => p.url().includes('facebook.com')) || await browser.newPage();
        
        // NUCLEAR OPTION for the first tab
        await fbPage.evaluateOnNewDocument(() => {
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

        await fbPage.goto('https://www.facebook.com/HashSYR24', { waitUntil: 'networkidle2' });
        
        console.log('Checking if we need to switch to Page profile...');
        await delay(3000);
        let clickedSwitch = await fbPage.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('div[role="button"], span, div'));
            const switchBtn = btns.find(b => {
                const text = b.textContent.trim().toLowerCase();
                return (text === 'switch now' || text === 'switch' || text === 'تبديل الآن' || text === 'تبديل') && b.getBoundingClientRect().width > 0 && b.children.length === 0;
            });
            if (switchBtn) {
                const target = switchBtn.closest('div[role="button"]') || switchBtn;
                target.click();
                return true;
            }
            return false;
        });

        if (clickedSwitch) {
            console.log('Clicked first switch, checking for secondary modal...');
            await delay(3000);
            await fbPage.evaluate(() => {
                const modalBtns = Array.from(document.querySelectorAll('div[role="button"], button, span, div'));
                const confirmSwitch = modalBtns.find(b => {
                    const text = b.textContent.trim().toLowerCase();
                    return (text === 'switch' || text === 'تبديل') && b.getBoundingClientRect().width > 0 && b.children.length === 0;
                });
                if (confirmSwitch) {
                    const t = confirmSwitch.closest('div[role="button"]') || confirmSwitch.closest('button') || confirmSwitch;
                    t.click();
                }
            });
            console.log('Switched to page profile! Waiting for reload...');
            await delay(6000); // wait for profile switch to finish loading
        }

        console.log('Clicking Write something / Create Post...');
        let clickedFbCreate = await fbPage.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('div[role="button"], span, div'));
            const createBtn = btns.find(b => {
                const text = b.textContent.trim().toLowerCase();
                return (
                    (text === 'write something...' || text === 'اكتب شيئًا...' || text === 'photo/video' || text === 'صورة/فيديو' || text === 'create post' || text === 'إنشاء منشور')
                ) && b.getBoundingClientRect().width > 0 && b.children.length === 0;
            });
            if (createBtn) {
                const target = createBtn.closest('div[role="button"]') || createBtn;
                target.click();
                return true;
            }
            return false;
        });

        if (!clickedFbCreate) {
            // Fallback: try finding any element with exact text
            clickedFbCreate = await fbPage.evaluate(() => {
                const all = Array.from(document.querySelectorAll('*'));
                const btn = all.find(el => el.textContent.trim() === 'Photo/video' && el.children.length === 0);
                if (btn) { btn.click(); return true; }
                return false;
            });
        }
        
        if (!clickedFbCreate) throw new Error('Could not find Write something button');
        await delay(5000);
        console.log('Finding hidden file input...');
        // We will NOT click any buttons to avoid triggering the OS File Chooser.
        // We just find the hidden input Facebook already has in the DOM.
        const fileInputs = await fbPage.$$('input[type="file"]');
        if (fileInputs.length > 0) {
            // Upload to the last one (usually the active one for the composer)
            await fileInputs[fileInputs.length - 1].uploadFile(imagePath);
            console.log('✅ FB Image uploaded successfully via direct hidden input!');
        } else {
            throw new Error('❌ Could not find FB file input in the DOM');
        }
        await delay(4000);

        await fbPage.keyboard.type(caption, {delay: 10});
        console.log('✅ FB Caption typed');
        await delay(3000);

        // Click multiple "Next" buttons if they appear in modal sequence
        for (let i = 0; i < 3; i++) {
            let clickedNext = await fbPage.evaluate(() => {
                const dialog = document.querySelector('div[role="dialog"]');
                const container = dialog || document;
                const btns = Array.from(container.querySelectorAll('div[role="button"], button'));
                const target = btns.find(b => {
                    const label = (b.getAttribute('aria-label') || '').toLowerCase();
                    const text = b.textContent.trim().toLowerCase();
                    return b.getBoundingClientRect().width > 0 && (label === 'next' || text === 'next' || text === 'التالي');
                });
                if (target) {
                    target.click();
                    return true;
                }
                return false;
            });
            if (clickedNext) {
                console.log('✅ FB Next clicked (Step ' + (i+1) + ')');
                await delay(3000);
            } else {
                break;
            }
        }

        console.log('Clicking Post on FB...');
        let clickedFbPost = false;
        // Keep checking for the Post button for up to 30 seconds to handle Facebook's slow modal loading
        for (let attempt = 0; attempt < 10; attempt++) {
            clickedFbPost = await fbPage.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('div[aria-label="Post"], div[aria-label="نشر"]'));
                const postBtn = btns.find(b => {
                    const isDisabled = b.getAttribute('aria-disabled') === 'true' || b.disabled;
                    return b.getBoundingClientRect().width > 0 && !isDisabled;
                });
                if (postBtn) {
                    postBtn.click();
                    return true;
                }
                const allBtns = Array.from(document.querySelectorAll('*')).filter(el => {
                    const text = el.textContent.trim().toLowerCase();
                    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
                    if ((text === 'post' || text === 'publish' || text === 'نشر') && el.children.length === 0) return true;
                    if ((aria === 'post' || aria === 'publish' || aria === 'نشر')) return true;
                    return false;
                });
                const visibleBtns = allBtns.filter(b => {
                    const isDisabled = b.getAttribute('aria-disabled') === 'true' || b.disabled;
                    return b.getBoundingClientRect().width > 0 && !isDisabled;
                });
                if (visibleBtns.length > 0) {
                    visibleBtns[visibleBtns.length - 1].click();
                    return true;
                }
                return false;
            });
            if (clickedFbPost) {
                console.log('✅ FB Post button clicked on attempt ' + (attempt + 1));
                break;
            }
            console.log('FB Post button not found yet, waiting 3 seconds...');
            await new Promise(r => setTimeout(r, 3000));
        }
        if (!clickedFbPost) throw new Error('Could not find FB Post button after 30 seconds');
        
        console.log('Waiting for potential FB Post Settings modal...');
        await delay(5000);
        
        let clickedSecondaryFbPost = await fbPage.evaluate(() => {
            // Find ALL elements that could be the post button
            const allBtns = Array.from(document.querySelectorAll('*')).filter(el => {
                const text = el.textContent.trim().toLowerCase();
                const aria = (el.getAttribute('aria-label') || '').toLowerCase();
                if ((text === 'post' || text === 'نشر') && el.children.length === 0) return true;
                if ((aria === 'post' || aria === 'نشر')) return true;
                return false;
            });
            
            // Only consider visible active buttons
            const visibleBtns = allBtns.filter(b => b.getBoundingClientRect().width > 0 && !b.getAttribute('aria-disabled'));
            
            if (visibleBtns.length > 0) {
                // The secondary modal one is usually the LAST one in the DOM
                const target = visibleBtns[visibleBtns.length - 1];
                const clickable = target.closest('div[role="button"]') || target.closest('button') || target;
                clickable.click();
                return true;
            }
            return false;
        });
        
        if (clickedSecondaryFbPost) {
            console.log('✅ FB Post submitted (from Post Settings modal)');
        } else {
            console.log('✅ FB Post submitted (direct)');
        }
        
        console.log('\n--- Facebook posting complete ---');
    } catch (e) {
        console.error('❌ Failed on Facebook:', e.message);
    }

    // 3. POST TO INSTAGRAM
    try {
        console.log('\n--- Posting to Instagram ---');
        let igPage = pages.find(p => p.url().includes('instagram.com')) || await browser.newPage();
        await igPage.bringToFront();
        await igPage.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });
        await delay(5000);

        console.log('Clicking IG Create button...');
        await igPage.evaluate(() => {
            const svgs = Array.from(document.querySelectorAll('svg'));
            const createSvg = svgs.find(svg => svg.getAttribute('aria-label') === 'New post' || 
                                             (svg.parentNode && svg.parentNode.textContent.includes('Create')));
            if (createSvg) {
                const btn = createSvg.closest('a') || createSvg.closest('button') || createSvg.closest('div[role="button"]') || createSvg.parentNode;
                if (btn && btn.click) {
                    btn.click();
                    return;
                }
            }
            const spans = Array.from(document.querySelectorAll('span'));
            const createSpan = spans.find(span => span.textContent === 'Create');
            if (createSpan) createSpan.click();
        });
        console.log('Finding hidden IG file input...');
        // We will NOT click 'Select from computer' to avoid the OS dialog.
        try {
            const igFileInput = await igPage.waitForSelector('input[accept*="image"], input[accept*="video"], input[type="file"]', { timeout: 5000 });
            await igFileInput.uploadFile(imagePath);
            console.log('✅ IG Image uploaded successfully via direct hidden input!');
        } catch(e) {
            throw new Error('❌ Could not find IG file input in the DOM');
        }
        await delay(5000);

        console.log('Setting IG Crop to Original...');
        await igPage.evaluate(() => {
            const svgs = Array.from(document.querySelectorAll('svg'));
            const cropSvg = svgs.find(svg => svg.getAttribute('aria-label') === 'Select crop' || svg.getAttribute('aria-label') === 'تحديد الاقتطاع');
            if (cropSvg) {
                const btn = cropSvg.closest('button') || cropSvg.parentNode;
                if (btn && btn.click) btn.click();
            }
        });
        await delay(1500);
        await igPage.evaluate(() => {
            const svgs = Array.from(document.querySelectorAll('svg'));
            const originalSvg = svgs.find(svg => svg.getAttribute('aria-label') === 'Photo outline icon' || svg.getAttribute('aria-label') === 'أيقونة مخطط الصورة');
            if (originalSvg) {
                const btn = originalSvg.closest('button') || originalSvg.closest('div[role="button"]') || originalSvg.parentNode;
                if (btn && btn.click) btn.click();
                return;
            }
            const spans = Array.from(document.querySelectorAll('span, div'));
            const originalBtn = spans.find(s => s.textContent.trim() === 'Original' || s.textContent.trim() === 'الأصلي');
            if (originalBtn) originalBtn.click();
        });
        await delay(2000);

        for (let i = 0; i < 2; i++) {
            let clickedNext = await igPage.evaluate(() => {
                const elements = Array.from(document.querySelectorAll('*')).filter(el => {
                    const text = el.textContent.trim().toLowerCase();
                    return (text === 'next' || text === 'التالي') && el.children.length === 0 && el.getBoundingClientRect().width > 0;
                });
                
                if (elements.length > 0) {
                    const target = elements[0].closest('button') || elements[0].closest('div[role="button"]') || elements[0];
                    target.click();
                    return true;
                }
                return false;
            });
            if (clickedNext) console.log(`✅ IG Next (Step ${i+1}) clicked`);
            await delay(3000);
        }

        try {
            console.log('Clicking IG caption box...');
            await igPage.waitForSelector('div[aria-label="Write a caption..."], div[aria-label="اكتب تعليقاً..."]', { timeout: 5000 });
            await igPage.click('div[aria-label="Write a caption..."], div[aria-label="اكتب تعليقاً..."]');
            await delay(1000);
            await igPage.keyboard.type(caption, { delay: 10 });
            console.log('✅ IG Caption typed');
        } catch (e) {
            console.log('❌ Could not type IG caption:', e.message);
        }

        console.log('Clicking Share on IG...');
        await delay(3000); // Wait for caption to register
        let clickedShare = await igPage.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('div[role="button"], button, span, div')).filter(el => {
                const text = el.textContent.trim().toLowerCase();
                return (text === 'share' || text === 'مشاركة') && el.children.length === 0 && el.getBoundingClientRect().width > 0;
            });
            if (elements.length > 0) {
                const target = elements[0].closest('button') || elements[0].closest('div[role="button"]') || elements[0];
                target.click();
                return true;
            }
            return false;
        });
        if (!clickedShare) {
            // Fallback
            clickedShare = await igPage.evaluate(() => {
                const all = Array.from(document.querySelectorAll('*'));
                const btn = all.find(el => (el.textContent.trim() === 'Share' || el.textContent.trim() === 'مشاركة') && el.children.length === 0);
                if (btn) { btn.click(); return true; }
                return false;
            });
        }
        if (!clickedShare) throw new Error('Could not find Share button');
        await delay(5000);
        console.log('✅ IG Share clicked');
        await delay(2000);
        await delay(4000);
    } catch (e) {
        console.error('❌ Failed on Instagram:', e.message);
    }

    // 4. POST TO TIKTOK
    try {
        console.log('--- Posting to TikTok ---');
        let tkImagePath = imagePath;

        let tkPage = pages.find(p => p.url().includes('tiktok.com')) || await browser.newPage();
        await tkPage.bringToFront();
        await tkPage.goto('https://www.tiktok.com/tiktokstudio/upload?scene=creator_center', { waitUntil: 'networkidle2' });
        await delay(5000);

        // Check for "Discard" popup
        await tkPage.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('div, button, span'));
            const discardBtn = btns.find(b => {
                const text = b.textContent.trim().toLowerCase();
                return (text === 'discard' || text === 'تجاهل') && b.getBoundingClientRect().width > 0;
            });
            if (discardBtn) {
                const target = discardBtn.closest('button') || discardBtn.closest('div[role="button"]') || discardBtn;
                target.click();
            }
        });
        await delay(2000);

        console.log('✅ TK Upload page opened');

        console.log('Converting image to MP4 for TikTok...');
        const { execSync } = require('child_process');
        const tkVideoPath = tkImagePath.replace(/\.[^/.]+$/, "") + '_tiktok.mp4';
        execSync(`ffmpeg -loop 1 -i "${tkImagePath}" -c:v libx264 -t 5 -pix_fmt yuv420p -vf scale=1080:1350 "${tkVideoPath}" -y`);
        console.log('✅ MP4 created:', tkVideoPath);

        const tkFileInputs = await tkPage.$$('input[type="file"]');
        if (tkFileInputs.length > 0) {
            await tkFileInputs[0].uploadFile(tkVideoPath);
            console.log('✅ TK Video uploaded');
        } else {
            throw new Error('TikTok File input not found');
        }
        await delay(5000);

        console.log('Waiting for TikTok to process video...');
        await delay(12000);

        try {
            fs.unlinkSync(tkVideoPath);
            console.log('✅ Temporary TikTok video deleted');
        } catch (e) {
            console.log('⚠️ Could not delete temporary video:', e.message);
        }

        const clickedTkDialogs = await tkPage.evaluate(() => {
            const dialogs = Array.from(document.querySelectorAll('[role="dialog"], .tiktok-dialog, div[data-e2e="modal"], div[class*="modal"]'));
            for (const d of dialogs) {
                // Close X button
                const svgs = Array.from(d.querySelectorAll('svg'));
                for (const svg of svgs) {
                    if (svg.innerHTML.includes('path') && svg.getBoundingClientRect().width < 40) {
                        const btn = svg.closest('div');
                        if (btn) btn.click();
                    }
                }
                const cancels = Array.from(d.querySelectorAll('button, div[role="button"]')).filter(b => {
                    const t = b.textContent.toLowerCase();
                    return t === 'cancel' || t === 'not now' || t === 'إلغاء' || t === 'ليس الآن' || t === 'no thanks' || t === 'skip' || t === 'تخطي';
                });
                if (cancels.length > 0) cancels[0].click();
            }
        });
        await delay(3000);

        try {
            await tkPage.type('.public-DraftEditor-content, [contenteditable="true"], .draft-editor', caption, { delay: 10 });
            console.log('✅ TK Caption typed');
        } catch (e) {
            console.log('❌ Could not focus TK caption editor:', e.message);
        }
        await delay(2000);

        const clickedTkPost = await tkPage.evaluate(() => {
            const dialogs = Array.from(document.querySelectorAll('[role="dialog"], .tiktok-dialog'));
            for (const d of dialogs) {
                const cancels = Array.from(d.querySelectorAll('button, div[role="button"]')).filter(b => b.textContent.toLowerCase() === 'cancel' || b.textContent.toLowerCase() === 'إلغاء');
                if (cancels.length > 0) cancels[0].click();
            }

            const btns = Array.from(document.querySelectorAll('button, div[role="button"]'));
            const target = btns.find(b => {
                const text = b.textContent.trim().toLowerCase();
                return b.getBoundingClientRect().width > 0 && (text === 'post' || text === 'نشر');
            });
            if (target) {
                target.click();
                return true;
            }
            return false;
        });

        if (clickedTkPost) console.log('✅ TK Post submitted');
        else throw new Error('Could not find TK Post button');
        await delay(4000);

    } catch (e) {
        console.error('❌ Failed on TikTok:', e.message);
    }

    console.log('\nPosting sequence completed!');
    browser.disconnect();
}

run().catch(console.error);
