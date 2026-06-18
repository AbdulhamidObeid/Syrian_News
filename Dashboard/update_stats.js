/**
 * update_stats.js
 * 
 * Fetches REAL live statistics from all connected social media APIs.
 * Writes the result to Dashboard/app/public/stats.json for the React dashboard.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const STATS_FILE = path.join(__dirname, 'app/public/stats.json');
const HISTORY_PATH = path.join(__dirname, '../posted_history.json');
const MEMORY_PATH = path.join(__dirname, '../memory.json');

async function fetchStats() {
    console.log("📊 Fetching live social media statistics...");

    const stats = {
        lastUpdated: new Date().toISOString(),
        platforms: {
            facebook:  { followers: 0, weeklyGrowth: 0, connected: false },
            instagram: { followers: 0, weeklyGrowth: 0, connected: false },
            telegram:  { followers: 0, weeklyGrowth: 0, connected: false },
            x:         { followers: 0, weeklyGrowth: 0, connected: false },
            tiktok:    { followers: 0, weeklyGrowth: 0, connected: false }
        },
        kpis: {
            totalAudience: 0,
            postsPublished: 0,
            pendingInMemory: 0
        },
        pipeline: {
            lastRun: null,
            status: 'unknown'
        }
    };

    // 1. Fetch Telegram Members
    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const channelId = process.env.TELEGRAM_CHANNEL_ID;
        if (botToken && channelId) {
            const res = await axios.get(`https://api.telegram.org/bot${botToken}/getChatMemberCount?chat_id=${channelId}`);
            if (res.data.ok) {
                stats.platforms.telegram.followers = res.data.result;
                stats.platforms.telegram.connected = true;
                console.log(`  ✅ Telegram: ${res.data.result} subscribers`);
            }
        }
    } catch (e) {
        console.error("  ❌ Telegram:", e.message);
    }

    // 2. Fetch Facebook & IG Followers via Graph API
    try {
        const fbToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
        const fbPageId = process.env.FACEBOOK_PAGE_ID;
        if (fbToken && fbPageId) {
            const res = await axios.get(`https://graph.facebook.com/v20.0/${fbPageId}?fields=followers_count,instagram_business_account{followers_count}&access_token=${fbToken}`);
            if (res.data.followers_count !== undefined) {
                stats.platforms.facebook.followers = res.data.followers_count;
                stats.platforms.facebook.connected = true;
                console.log(`  ✅ Facebook: ${res.data.followers_count} followers`);
            }
            if (res.data.instagram_business_account && res.data.instagram_business_account.followers_count !== undefined) {
                stats.platforms.instagram.followers = res.data.instagram_business_account.followers_count;
                stats.platforms.instagram.connected = true;
                console.log(`  ✅ Instagram: ${res.data.instagram_business_account.followers_count} followers`);
            }
        }
    } catch (e) {
        console.error("  ❌ FB/IG:", e.response ? e.response.data.error.message : e.message);
    }

    // 3. Fetch TikTok Followers via Zernio Accounts API
    try {
        const zernioKey = process.env.ZERNIO_API_KEY;
        if (zernioKey) {
            const res = await axios.get('https://zernio.com/api/v1/accounts', {
                headers: { 'Authorization': `Bearer ${zernioKey}` }
            });
            const tkAccount = res.data.accounts.find(acc => acc.platform === 'tiktok');
            if (tkAccount) {
                stats.platforms.tiktok.followers = tkAccount.followersCount || 0;
                stats.platforms.tiktok.connected = tkAccount.isActive || false;
                console.log(`  ✅ TikTok: ${stats.platforms.tiktok.followers} followers (via Zernio)`);
            }
        }
    } catch (e) {
        console.error("  ❌ TikTok/Zernio:", e.response ? e.response.data : e.message);
    }

    // 4. X (Twitter) — no read API available via Buffer, mark as connected but 0
    stats.platforms.x.connected = !!process.env.TWITTER_ACCESS_TOKEN;
    if (stats.platforms.x.connected) {
        console.log(`  ⚠️  X: Connected (no follower read API — showing 0)`);
    }

    // 5. Compute KPIs
    stats.kpis.totalAudience = Object.values(stats.platforms).reduce((sum, p) => sum + p.followers, 0);

    // Posts published
    try {
        if (fs.existsSync(HISTORY_PATH)) {
            const history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
            stats.kpis.postsPublished = Array.isArray(history) ? history.filter(h => !h.startsWith('slot_') && !h.startsWith('routine_')).length : 0;
        }
    } catch (e) { /* ignore */ }

    // Memory state
    try {
        if (fs.existsSync(MEMORY_PATH)) {
            const memory = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
            stats.kpis.pendingInMemory = Array.isArray(memory) ? memory.length : 0;
            if (memory.length > 0 && memory[0].fetchedAt) {
                stats.pipeline.lastRun = new Date(memory[0].fetchedAt).toISOString();
            }
        }
    } catch (e) { /* ignore */ }

    stats.pipeline.status = 'operational';

    // Write
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf8');
    console.log(`\n✅ Stats written to ${STATS_FILE}`);
    console.log(`   Total Audience: ${stats.kpis.totalAudience}`);
}

if (require.main === module) {
    fetchStats();
}

module.exports = fetchStats;
