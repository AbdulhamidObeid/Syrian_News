const { spawn } = require('child_process');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const credentialsPath = '/Users/obeid/.config/higgsfield/credentials.json';
const mcpConfigPath = '/Users/obeid/.gemini/config/mcp_config.json';

async function run() {
    console.log("Starting Higgsfield CLI login process...");
    
    // Spawn the higgsfield auth login process
    const cliProcess = spawn('npx', [
        '-p', '@higgsfield/cli',
        'higgsfield', 'auth', 'login'
    ]);

    let authUrl = null;

    cliProcess.stdout.on('data', (data) => {
        const text = data.toString();
        console.log(`[CLI]: ${text.trim()}`);
        
        // Match device login URL
        const match = text.match(/https:\/\/higgsfield\.ai\/device\?code=[A-Za-z0-9_\-]+/);
        if (match) {
            authUrl = match[0];
            console.log(`\nDetected auth URL: ${authUrl}`);
            approveUrl(authUrl).catch(err => {
                console.error("❌ Error during approval:", err.message);
                cliProcess.kill();
            });
        }
    });

    cliProcess.stderr.on('data', (data) => {
        console.error(`[CLI Error]: ${data.toString().trim()}`);
    });

    return new Promise((resolve, reject) => {
        cliProcess.on('close', async (code) => {
            console.log(`CLI login process exited with code ${code}`);
            if (code === 0) {
                console.log("✅ CLI login completed successfully!");
                // Now read the token and update MCP config
                try {
                    await updateMcpConfig();
                    resolve();
                } catch (err) {
                    reject(err);
                }
            } else {
                reject(new Error(`CLI process exited with non-zero code ${code}`));
            }
        });
    });
}

async function approveUrl(url) {
    console.log("\nConnecting to running Chrome on 9222 to approve device code...");
    const browser = await puppeteer.connect({
        browserURL: 'http://localhost:9222',
        protocolTimeout: 120000
    });

    const page = await browser.newPage();
    try {
        await page.setViewport({ width: 1280, height: 800 });
        console.log(`Navigating to approval URL: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        console.log("Waiting 5 seconds for page load and Clerk authentication check...");
        await new Promise(r => setTimeout(r, 5000));

        // Let's print the buttons on the page to help debug if it fails
        const buttons = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('button, a')).map(el => ({
                tag: el.tagName,
                text: el.innerText ? el.innerText.trim() : "",
                className: el.className
            }));
        });
        console.log("Buttons found on approval page:", JSON.stringify(buttons, null, 2));

        // Click the confirm/approve button.
        // We will look for common terms like "Confirm", "Approve", "Allow", "Authorize", "Submit", "Yes"
        // Also look for Arabic equivalents "تأكيد", "موافق", "سماح"
        const clicked = await page.evaluate(() => {
            const clickables = Array.from(document.querySelectorAll('button, a'));
            const keywords = ['confirm', 'approve', 'allow', 'authorize', 'submit', 'yes', 'تأكيد', 'موافق', 'سماح'];
            
            // Try to find by text content match
            for (const el of clickables) {
                const text = el.innerText ? el.innerText.toLowerCase().trim() : "";
                if (keywords.some(kw => text.includes(kw))) {
                    el.click();
                    return { success: true, text: el.innerText };
                }
            }
            
            // Fallback: If there is exactly one primary button, click it
            const primaryBtn = document.querySelector('button[type="submit"]') || document.querySelector('button.button-primary');
            if (primaryBtn) {
                primaryBtn.click();
                return { success: true, text: primaryBtn.innerText || "Primary Submit Button" };
            }

            return { success: false };
        });

        if (clicked.success) {
            console.log(`Clicked confirmation button: "${clicked.text}"`);
            console.log("Waiting 5 seconds for authorization redirect...");
            await new Promise(r => setTimeout(r, 5000));
            
            // Take screenshot to log state
            const screenshotPath = path.join(__dirname, 'approve_result.png');
            await page.screenshot({ path: screenshotPath });
            console.log(`Saved screenshot of result to: ${screenshotPath}`);
        } else {
            console.warn("⚠️ Could not find confirmation button. Page may have auto-approved, or layout differs.");
        }

    } finally {
        await page.close();
        browser.disconnect();
    }
}

async function updateMcpConfig() {
    if (!fs.existsSync(credentialsPath)) {
        throw new Error(`Credentials file not found at ${credentialsPath}`);
    }
    const creds = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    const newToken = creds.access_token;
    
    if (!newToken || !newToken.startsWith('hf_')) {
        throw new Error(`Invalid token in credentials: ${newToken}`);
    }
    
    if (!fs.existsSync(mcpConfigPath)) {
        throw new Error(`MCP config file not found at ${mcpConfigPath}`);
    }
    
    const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
    
    if (!mcpConfig.mcpServers || !mcpConfig.mcpServers.higgsfield) {
        throw new Error(`mcpServers.higgsfield not found in MCP config`);
    }
    
    const hf = mcpConfig.mcpServers.higgsfield;
    
    // Update args
    const authArgIndex = hf.args.findIndex(arg => arg.startsWith('Authorization: Bearer '));
    if (authArgIndex !== -1) {
        hf.args[authArgIndex] = `Authorization: Bearer ${newToken}`;
    } else {
        hf.args.push("-e", `Authorization: Bearer ${newToken}`);
    }
    
    // Update env
    if (!hf.env) hf.env = {};
    hf.env.HIGGSFIELD_API_KEY = newToken;
    hf.env.BEARER_TOKEN = newToken;
    hf.env.Authorization = `Bearer ${newToken}`;
    
    fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
    console.log("\n==========================================================");
    console.log("✅ SUCCESS! Global mcp_config.json updated with new active CLI token.");
    console.log(`Token Prefix: ${newToken.substring(0, 15)}...`);
    console.log("==========================================================");
}

run().catch(console.error);
