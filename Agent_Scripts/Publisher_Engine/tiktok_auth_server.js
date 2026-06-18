require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// TikTok API Credentials
const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

if (!CLIENT_KEY || !CLIENT_SECRET) {
    console.error('❌ TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET not found in .env');
    process.exit(1);
}

// Step 1: Generate Authorization URL
app.get('/login', (req, res) => {
    // Generate a random 16 character string for CSRF protection
    const csrfState = Math.random().toString(36).substring(2, 18);
    
    // The required scopes for Content Posting API
    const scopes = 'user.info.basic,video.publish,video.upload';

    let url = 'https://www.tiktok.com/v2/auth/authorize/';
    url += `?client_key=${CLIENT_KEY}`;
    url += `&scope=${scopes}`;
    url += `&response_type=code`;
    url += `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
    url += `&state=${csrfState}`;
    
    console.log('\n======================================');
    console.log('✅ Click here to authorize TikTok:');
    console.log(`http://localhost:${PORT}/login`);
    console.log('======================================\n');
    
    // Redirect the browser to TikTok's login page
    res.redirect(url);
});

// Step 2: Handle the Callback from TikTok
app.get('/callback', async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
        return res.send(`<h2>Authorization Failed</h2><p>${error}</p>`);
    }

    if (!code) {
        return res.send('<h2>Error: No authorization code received.</h2>');
    }

    console.log('✅ Received authorization code from TikTok. Trading it for Access Token...');

    try {
        // Trade the code for an Access Token
        const tokenResponse = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', 
            new URLSearchParams({
                client_key: CLIENT_KEY,
                client_secret: CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: REDIRECT_URI
            }).toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cache-Control': 'no-cache'
                }
            }
        );

        const data = tokenResponse.data;

        if (data.error) {
            throw new Error(data.error_description || data.error);
        }

        const accessToken = data.access_token;
        const refreshToken = data.refresh_token;
        const openId = data.open_id;

        // Save to .env file
        const envPath = path.join(__dirname, '..', '..', '.env');
        let envContent = fs.readFileSync(envPath, 'utf8');
        
        envContent += `\n# TikTok Tokens (Auto-Generated)\n`;
        envContent += `TIKTOK_ACCESS_TOKEN="${accessToken}"\n`;
        envContent += `TIKTOK_REFRESH_TOKEN="${refreshToken}"\n`;
        envContent += `TIKTOK_OPEN_ID="${openId}"\n`;

        fs.writeFileSync(envPath, envContent);

        console.log('\n🎉 SUCCESS! TikTok Access Token acquired and saved to .env!');
        console.log('You can now close this terminal and the browser tab.');
        
        res.send('<h2>🎉 Success!</h2><p>Your TikTok account is linked. You can close this tab and go back to the terminal.</p>');

        // Kill server after 2 seconds
        setTimeout(() => process.exit(0), 2000);

    } catch (err) {
        console.error('❌ Failed to get access token:', err.response ? err.response.data : err.message);
        res.send(`<h2>Failed to get Access Token</h2><p>${err.message}</p>`);
    }
});

app.listen(PORT, () => {
    console.log(`\n🚀 TikTok Auth Server is running!`);
    console.log(`Go to your TikTok Developer Dashboard -> Your App -> Products -> Login Kit -> Settings.`);
    console.log(`Add this exact URL to the "Redirect URIs" list: ${REDIRECT_URI}`);
    console.log(`\nAfter saving it there, open your browser and go to:`);
    console.log(`http://localhost:${PORT}/login`);
});
