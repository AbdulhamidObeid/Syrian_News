const fs = require('fs');
const os = require('os');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });


async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendTelegramAlert(message) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const adminId = process.env.TELEGRAM_ADMIN_ID;
    if (botToken && adminId) {
        try {
            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                chat_id: adminId,
                text: message
            });
        } catch (e) {
            console.error('Failed to send Telegram alert:', e.message);
        }
    }
}

async function getBrowser() {
    let browser;
    try {
        browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    } catch (e) {
        const profilePath = path.join(os.homedir(), '.gemini', 'antigravity-browser-profile');
        browser = await puppeteer.launch({
            headless: false,
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            userDataDir: profilePath,
            defaultViewport: null,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized']
        });
    }
    
    // NUCLEAR OPTION to prevent OS File Choosers
    await browser.on('targetcreated', async (target) => {
        if (target.type() === 'page') {
            const newPage = await target.page();
            if (newPage) {
                await newPage.evaluateOnNewDocument(() => {
                    const originalClick = window.HTMLInputElement.prototype.click;
                    window.HTMLInputElement.prototype.click = function() {
                        if (this.type === 'file') return;
                        return originalClick.call(this);
                    };
                    window.showOpenFilePicker = async () => [];
                });
            }
        }
    });
    return browser;
}

async function publishPost(imagePath, captionLong, captionShort) {
    if (!captionLong) captionLong = "No caption";
    if (!captionShort) captionShort = "No caption";
    captionLong = captionLong.replace(/\\n/g, '\n');
    captionShort = captionShort.replace(/\\n/g, '\n');
    const imageArray = typeof imagePath === 'string' ? imagePath.split(',') : imagePath;
    
    let browser = null;
    let pages = [];

    // --- ZERNIO HOSTING FOR APIS (Facebook/IG/X) ---
    const uploadedUrls = [];
    try {
        console.log(`Uploading ${imageArray.length} image(s) to Zernio for hosting...`);
        const zernioKey = process.env.ZERNIO_API_KEY;
        for (const img of imageArray) {
            const mediaForm = new FormData();
            mediaForm.append('files', fs.createReadStream(img));
            const res = await axios.post('https://zernio.com/api/v1/media', mediaForm, {
                headers: { ...mediaForm.getHeaders(), 'Authorization': `Bearer ${zernioKey}` }
            });
            uploadedUrls.push(res.data.files[0].url);
        }
        console.log(`  ✅ Uploaded ${uploadedUrls.length} image(s) to Zernio.`);
    } catch (e) {
        console.error('Zernio upload failed:', e.message);
    }

    // --- X (TWITTER) ---
    console.log('\n--- Posting to X (Twitter) ---');
    let xApiSuccess = false;
    for (let i = 0; i < 3 && !xApiSuccess && uploadedUrls.length > 0; i++) {
        try {
            const bufferToken = process.env.BUFFER_ACCESS_TOKEN;
            const bufferChannelId = process.env.BUFFER_CHANNEL_ID;
            const res = await axios.post('https://api.buffer.com', {
                query: `mutation createPost($input: CreatePostInput!) { createPost(input: $input) { ... on PostActionSuccess { post { id } } } }`,
                variables: { input: { channelId: bufferChannelId, schedulingType: 'automatic', mode: 'shareNow', text: captionShort, assets: uploadedUrls.map(url => ({ image: { url } })) } }
            }, { headers: { 'Authorization': `Bearer ${bufferToken}`, 'Content-Type': 'application/json' } });
            
            if (res.data.errors) throw new Error(JSON.stringify(res.data.errors));
            console.log('✅ X Posted via API');
            xApiSuccess = true;
        } catch (e) { console.log(`X API Attempt ${i+1} failed.`); await delay(2000); }
    }

    if (!xApiSuccess) {
        await sendTelegramAlert('⚠️ X (Twitter) API failed 3 times. Resorting to Web-Bot.');
        try {
            if (!browser) { browser = await getBrowser(); pages = await browser.pages(); }
            let p = pages.find(pg => pg.url().includes('x.com')) || await browser.newPage();
            await p.bringToFront(); await p.goto('https://x.com/compose/post', { waitUntil: 'networkidle2' }); await delay(4000);
            const fileInput = await p.waitForSelector('input[data-testid="fileInput"]', { timeout: 5000 });
            for (const img of imageArray) { await fileInput.uploadFile(img); await delay(1000); }
            await p.type('[data-testid="tweetTextarea_0"]', captionShort); await delay(2000);
            const clicked = await p.evaluate(() => {
                const btn = Array.from(document.querySelectorAll('button[data-testid="tweetButton"]')).find(b => b.offsetParent !== null && !b.disabled);
                if (btn) { btn.click(); return true; } return false;
            });
            if (clicked) console.log('✅ X Posted via Web-Bot');
        } catch (e) { console.error('❌ X Web-Bot failed:', e.message); }
    }

    // --- FACEBOOK PAGE ---
    console.log('\n--- Posting to Facebook Page ---');
    let fbApiSuccess = false;
    const fbToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    const fbPageId = process.env.FACEBOOK_PAGE_ID;
    
    if (fbToken && fbPageId && uploadedUrls.length > 0) {
        for (let i = 0; i < 3 && !fbApiSuccess; i++) {
            try {
                if (uploadedUrls.length === 1) {
                    await axios.post(`https://graph.facebook.com/v20.0/${fbPageId}/photos`, { url: uploadedUrls[0], message: captionLong, access_token: fbToken });
                } else {
                    const mediaIds = [];
                    for (const url of uploadedUrls) {
                        const r = await axios.post(`https://graph.facebook.com/v20.0/${fbPageId}/photos`, { url, published: false, access_token: fbToken });
                        mediaIds.push(r.data.id);
                    }
                    await axios.post(`https://graph.facebook.com/v20.0/${fbPageId}/feed`, { message: captionLong, attached_media: mediaIds.map(id => ({ media_fbid: id })), access_token: fbToken });
                }
                console.log('✅ Facebook Posted via API');
                fbApiSuccess = true;
            } catch (e) { 
                console.error(`FB API Attempt ${i+1} failed:`, e.response?.data || e.message); 
                await delay(2000); 
            }
        }
    }

    if (!fbApiSuccess) {
        await sendTelegramAlert('⚠️ Facebook API failed 3 times. Resorting to Web-Bot.');
        try {
            if (!browser) { browser = await getBrowser(); pages = await browser.pages(); }
            let p = pages.find(pg => pg.url().includes('facebook.com')) || await browser.newPage();
            await p.bringToFront(); await p.goto('https://www.facebook.com/HashSYR24', { waitUntil: 'networkidle2' }); await delay(5000);
            const fileInputs = await p.$$('input[type="file"][accept*="image"]');
            if (fileInputs.length > 0) {
                for (const img of imageArray) { await fileInputs[0].uploadFile(img); await delay(1000); }
                const captionInput = await p.$('div[role="textbox"][contenteditable="true"]');
                if (captionInput) { await captionInput.focus(); await p.keyboard.type(captionLong, { delay: 10 }); }
                await delay(2000);
                const postBtn = Array.from(await p.$$('div[role="button"]')).pop(); // Simplification
                if (postBtn) { await postBtn.click(); console.log('✅ FB Posted via Web-Bot'); }
            }
        } catch (e) { console.error('❌ FB Web-Bot failed:', e.message); }
    }

    // --- INSTAGRAM ---
    console.log('\n--- Posting to Instagram ---');
    let igApiSuccess = false;
    if (fbToken && fbPageId && uploadedUrls.length > 0) {
        for (let i = 0; i < 3 && !igApiSuccess; i++) {
            try {
                const accRes = await axios.get(`https://graph.facebook.com/v20.0/${fbPageId}?fields=instagram_business_account&access_token=${fbToken}`);
                const igId = accRes.data?.instagram_business_account?.id;
                if (igId) {
                    if (uploadedUrls.length === 1) {
                        const r1 = await axios.post(`https://graph.facebook.com/v20.0/${igId}/media`, { image_url: uploadedUrls[0], caption: captionLong, access_token: fbToken });
                        await axios.post(`https://graph.facebook.com/v20.0/${igId}/media_publish`, { creation_id: r1.data.id, access_token: fbToken });
                    } else {
                        const itemIds = [];
                        for (const url of uploadedUrls) {
                            const r = await axios.post(`https://graph.facebook.com/v20.0/${igId}/media`, { image_url: url, is_carousel_item: true, access_token: fbToken });
                            itemIds.push(r.data.id);
                        }
                        const cRes = await axios.post(`https://graph.facebook.com/v20.0/${igId}/media`, { caption: captionLong, media_type: 'CAROUSEL', children: itemIds.join(','), access_token: fbToken });
                        await axios.post(`https://graph.facebook.com/v20.0/${igId}/media_publish`, { creation_id: cRes.data.id, access_token: fbToken });
                    }
                    console.log('✅ Instagram Posted via API');
                    igApiSuccess = true;
                } else {
                    console.log(`❌ IG ID not found in response:`, JSON.stringify(accRes.data));
                    break;
                }
            } catch (e) {
                console.log(`IG API Attempt ${i+1} failed:`, e.response?.data?.error?.message || e.message);
                await delay(2000);
            }
        }
    } else {
        console.log(`Skipping IG API due to missing credentials or images.`);
    }

    if (!igApiSuccess) {
        await sendTelegramAlert('⚠️ Instagram API failed 3 times. Resorting to Web-Bot.');
        try {
            if (!browser) { browser = await getBrowser(); pages = await browser.pages(); }
            let p = pages.find(pg => pg.url().includes('instagram.com')) || await browser.newPage();
            await p.bringToFront(); await p.goto('https://www.instagram.com', { waitUntil: 'networkidle2' }); await delay(4000);
            
            await p.evaluate(() => {
                const svgs = Array.from(document.querySelectorAll('svg[aria-label="New post"]'));
                if (svgs.length > 0) svgs[0].closest('a, div[role="button"]').click();
            });
            await delay(3000);
            const fileInput = await p.$('input[type="file"]');
            if (fileInput) {
                // Upload all
                await fileInput.uploadFile(...imageArray);
                await delay(2000);
                
                // Next, Next, Share
                for(let step=0; step<2; step++) {
                    await p.evaluate(() => {
                        const btns = Array.from(document.querySelectorAll('div[role="button"]'));
                        const next = btns.find(b => b.textContent === 'Next');
                        if (next) next.click();
                    });
                    await delay(2000);
                }
                
                const captionBox = await p.$('div[aria-label="Write a caption..."]');
                if (captionBox) await captionBox.type(captionLong, {delay: 10});
                
                await p.evaluate(() => {
                    const btns = Array.from(document.querySelectorAll('div[role="button"]'));
                    const share = btns.find(b => b.textContent === 'Share');
                    if (share) share.click();
                });
                console.log('✅ IG Posted via Web-Bot');
            }
        } catch (e) { console.error('❌ IG Web-Bot failed:', e.message); }
    }

    // TikTok publishing has been removed from this pipeline.

    if (browser) await browser.disconnect();
    console.log('\n🎉 Pipeline Complete!');
    await sendTelegramAlert('🎉 Post processing has finished across all platforms. Check your social media accounts to confirm it went live!');
}

module.exports = { publishPost };
// For direct CLI testing
if (require.main === module) {
    const images = process.argv[2];
    const caption = process.argv[3];
    if (images && caption) publishPost(images, caption, caption).catch(console.error);
}
