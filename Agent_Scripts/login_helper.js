/**
 * login_helper.js
 * 
 * Interactive utility to help the user log in to social media platforms and Higgsfield.
 * Reuses the active agent Chrome profile (/Users/obeid/.gemini/antigravity-browser-profile)
 * and automatically extracts Higgsfield authentication tokens.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const os = require('os');

const profilePath = '/Users/obeid/.gemini/antigravity-browser-profile';
const credentialsPath = '/Users/obeid/.config/higgsfield/credentials.json';

async function run() {
    console.log("==========================================================");
    console.log("🚀 Syrian News Agency (HashSYR24) - Login Helper Tool");
    console.log("==========================================================");
    console.log(`Reusing Chrome agent profile: ${profilePath}\n`);
    console.log("1. We will open Chrome on your desktop.");
    console.log("2. Please log in to X (Twitter), Facebook, Instagram, TikTok, and Higgsfield.");
    console.log("3. Once logged in, return here and press ENTER to extract tokens and close Chrome.");
    console.log("==========================================================\n");

    const browser = await puppeteer.launch({
        headless: false,
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        userDataDir: profilePath,
        defaultViewport: null,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized']
    });

    const page = await browser.newPage();
    
    // Open login pages in tabs
    console.log("Opening login tabs...");
    await page.goto('https://higgsfield.ai/', { waitUntil: 'domcontentloaded' });
    
    const fbPage = await browser.newPage();
    await fbPage.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded' });
    
    const igPage = await browser.newPage();
    await igPage.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
    
    const xPage = await browser.newPage();
    await xPage.goto('https://x.com/login', { waitUntil: 'domcontentloaded' });

    const tkPage = await browser.newPage();
    await tkPage.goto('https://www.tiktok.com/login', { waitUntil: 'domcontentloaded' });

    // Focus on Higgsfield tab first
    await page.bringToFront();

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('\n👉 Log in to all accounts in Chrome. Once finished, press [ENTER] here: ', async () => {
        rl.close();
        console.log("\nExtracting Higgsfield auth tokens...");

        try {
            await page.bringToFront();
            
            // Extract supabase auth token from localStorage on higgsfield.ai
            const tokens = await page.evaluate(() => {
                let keys = Object.keys(localStorage);
                let authKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
                if (!authKey) return null;
                
                try {
                    let sessionData = JSON.parse(localStorage.getItem(authKey));
                    return {
                        access_token: sessionData.access_token,
                        refresh_token: sessionData.refresh_token
                    };
                } catch (e) {
                    return null;
                }
            });

            if (tokens && tokens.access_token) {
                // Ensure directory exists
                const credentialsDir = path.dirname(credentialsPath);
                if (!fs.existsSync(credentialsDir)) {
                    fs.mkdirSync(credentialsDir, { recursive: true });
                }

                fs.writeFileSync(credentialsPath, JSON.stringify(tokens, null, 2));
                console.log(`\n✅ Successfully extracted Higgsfield tokens and wrote them to: ${credentialsPath}`);
                console.log(`Access Token: ${tokens.access_token.substring(0, 10)}...`);
            } else {
                console.log("\n⚠️ Warning: Could not find Higgsfield login token in localStorage. Make sure you logged in to higgsfield.ai successfully.");
            }
        } catch (e) {
            console.error("\n❌ Error extracting Higgsfield tokens:", e.message);
        } finally {
            console.log("\nClosing browser...");
            await browser.close();
            console.log("Done! You can now run the curation and posting scripts successfully.");
            process.exit(0);
        }
    });
}

run().catch(console.error);
