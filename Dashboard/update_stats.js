/**
 * update_stats.js
 * 
 * Fetches REAL live statistics from all connected social media APIs.
 * Per-platform insights: Facebook, Instagram, X (Twitter), Telegram.
 * Writes to Dashboard/app/public/stats.json for the React dashboard.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs   = require('fs');
const path = require('path');
const axios = require('axios');

const STATS_FILE          = path.join(__dirname, 'app/public/stats.json');
const HISTORY_PATH        = path.join(__dirname, '../posted_history.json');
const MEMORY_PATH         = path.join(__dirname, '../memory.json');
const POST_LOG_PATH       = path.join(__dirname, '../post_log.json');
const SCHEDULE_CONFIG_PATH = path.join(__dirname, '../Config/schedule_config.json');

function getTodayStr() { return new Date().toISOString().split('T')[0]; }

async function fetchStats() {
    console.log('📊 Fetching live social media statistics...\n');

    const stats = {
        lastUpdated: new Date().toISOString(),
        platforms: {
            facebook:  { followers: 0, connected: false },
            instagram: { followers: 0, connected: false },
            telegram:  { followers: 0, connected: false },
            x:         { followers: 0, connected: false }
        },
        kpis: {
            totalAudience:    0,
            postsPublished:   0,
            storyLibrary:     0,
            postsToday:       0,
            weeklyPostCounts: {}
        },
        platformInsights: {
            facebook: {
                weeklyViews:      0,
                weeklyEngaged:    0,
                weeklyNewFollows: 0,
                postsLikes:       0,
                postsComments:    0,
                postsShares:      0,
                available:        false
            },
            instagram: {
                weeklyReach:         0,
                totalInteractions:   0,
                likes:               0,
                comments:            0,
                saves:               0,
                shares:              0,
                profileViews:        0,
                available:           false
            },
            x: {
                weeklyImpressions: 0,
                weeklyLikes:       0,
                weeklyRetweets:    0,
                weeklyReplies:     0,
                available:         false,
                note:              ''
            },
            telegram: {
                members:    0,
                available:  false,
                note:       'Message-level views require Bot polling'
            }
        },
        topPosts:       [],
        contentPillars: [],
        pipeline:       { lastRun: null, status: 'unknown' }
    };

    // ─── 1. TELEGRAM ────────────────────────────────────────────────────────
    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const channelId = process.env.TELEGRAM_CHANNEL_ID;
        if (botToken && channelId) {
            const res = await axios.get(`https://api.telegram.org/bot${botToken}/getChatMemberCount?chat_id=${channelId}`);
            if (res.data.ok) {
                stats.platforms.telegram.followers = res.data.result;
                stats.platforms.telegram.connected = true;
                stats.platformInsights.telegram.members = res.data.result;
                stats.platformInsights.telegram.available = true;
                console.log(`  ✅ Telegram: ${res.data.result} subscribers`);
            }
        }
    } catch (e) { console.error('  ❌ Telegram:', e.message); }

    // ─── 2. FACEBOOK — get system-user token first, then exchange for page token ─
    let fbToken = null, fbPageId = null, fbPageToken = null, igId = null;
    try {
        fbToken  = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
        fbPageId = process.env.FACEBOOK_PAGE_ID;

        if (fbToken && fbPageId) {
            // Get page-specific token (required for /published_posts, /insights)
            const pageRes = await axios.get(
                `https://graph.facebook.com/v20.0/${fbPageId}?fields=access_token,followers_count,instagram_business_account{followers_count,id}&access_token=${fbToken}`
            );
            fbPageToken = pageRes.data.access_token || fbToken;

            stats.platforms.facebook.followers = pageRes.data.followers_count || 0;
            stats.platforms.facebook.connected = true;
            console.log(`  ✅ Facebook: ${stats.platforms.facebook.followers} followers`);

            if (pageRes.data.instagram_business_account) {
                igId = pageRes.data.instagram_business_account.id;
                stats.platforms.instagram.followers = pageRes.data.instagram_business_account.followers_count || 0;
                stats.platforms.instagram.connected = true;
                console.log(`  ✅ Instagram: ${stats.platforms.instagram.followers} followers`);
            }
        }
    } catch (e) { console.error('  ❌ FB init:', e.response?.data?.error?.message || e.message); }

    // ─── 3. FACEBOOK INSIGHTS (valid metrics for page token) ────────────────
    if (fbPageToken && fbPageId) {
        try {
            const res = await axios.get(
                `https://graph.facebook.com/v20.0/${fbPageId}/insights?metric=page_views_total,page_post_engagements,page_daily_follows&period=day&access_token=${fbPageToken}`
            );
            const data = res.data?.data || [];
            for (const metric of data) {
                // Sum last 7 day values
                const vals = metric.values || [];
                const last7 = vals.slice(-7).reduce((s, v) => s + (typeof v.value === 'number' ? v.value : 0), 0);
                if (metric.name === 'page_views_total')     stats.platformInsights.facebook.weeklyViews      = last7;
                if (metric.name === 'page_post_engagements') stats.platformInsights.facebook.weeklyEngaged   = last7;
                if (metric.name === 'page_daily_follows')   stats.platformInsights.facebook.weeklyNewFollows = last7;
            }
            stats.platformInsights.facebook.available = true;
            console.log(`  ✅ FB Insights: views=${stats.platformInsights.facebook.weeklyViews}, engaged=${stats.platformInsights.facebook.weeklyEngaged}`);
        } catch (e) {
            console.error('  ❌ FB Page Insights:', e.response?.data?.error?.message || e.message);
        }

        // 4. FACEBOOK PUBLISHED POSTS — aggregate likes/comments/shares + top posts
        try {
            const postsRes = await axios.get(
                `https://graph.facebook.com/v20.0/${fbPageId}/published_posts?fields=id,message,full_picture,created_time,likes.summary(true),comments.summary(true),shares&limit=15&access_token=${fbPageToken}`
            );
            const posts = postsRes.data?.data || [];
            console.log(`  ✅ FB Posts: ${posts.length} fetched`);

            let totalLikes = 0, totalComments = 0, totalShares = 0;
            const enriched = [];

            for (const post of posts) {
                const likes    = post.likes?.summary?.total_count    || 0;
                const comments = post.comments?.summary?.total_count || 0;
                const shares   = post.shares?.count                  || 0;
                totalLikes    += likes;
                totalComments += comments;
                totalShares   += shares;

                // Try to get reach per post
                let reach = 0;
                try {
                    const piRes = await axios.get(
                        `https://graph.facebook.com/v20.0/${post.id}/insights?metric=post_impressions_unique&access_token=${fbPageToken}`
                    );
                    reach = piRes.data?.data?.[0]?.values?.[0]?.value || 0;
                } catch (_) {}

                enriched.push({
                    id: post.id,
                    message: (post.message || '').substring(0, 140),
                    thumbnail: post.full_picture || null,
                    createdAt: post.created_time,
                    likes, comments, shares, reach,
                    platform: 'facebook'
                });
            }

            stats.platformInsights.facebook.postsLikes    = totalLikes;
            stats.platformInsights.facebook.postsComments = totalComments;
            stats.platformInsights.facebook.postsShares   = totalShares;
            stats.platformInsights.facebook.available     = true;

            // Sort by likes+comments+shares as proxy when reach=0
            enriched.sort((a, b) => (b.reach || (b.likes + b.comments*2 + b.shares*3)) - (a.reach || (a.likes + a.comments*2 + a.shares*3)));
            stats.topPosts = enriched.slice(0, 5);
            console.log(`  ✅ FB Aggregated: likes=${totalLikes}, comments=${totalComments}, shares=${totalShares}`);
        } catch (e) {
            console.error('  ❌ FB Posts:', e.response?.data?.error?.message || e.message);
        }
    }

    // ─── 5. INSTAGRAM INSIGHTS ───────────────────────────────────────────────
    if (fbPageToken && igId) {
        try {
            // reach uses period=week, interaction metrics need metric_type=total_value
            const [reachRes, interactRes] = await Promise.allSettled([
                axios.get(`https://graph.facebook.com/v20.0/${igId}/insights?metric=reach,profile_views&period=week&access_token=${fbPageToken}`),
                axios.get(`https://graph.facebook.com/v20.0/${igId}/insights?metric=total_interactions,likes,comments,saves,shares&metric_type=total_value&period=day&access_token=${fbPageToken}`)
            ]);

            if (reachRes.status === 'fulfilled') {
                for (const m of reachRes.value.data?.data || []) {
                    const val = m.values?.[m.values.length - 1]?.value || 0;
                    if (m.name === 'reach')         stats.platformInsights.instagram.weeklyReach   = val;
                    if (m.name === 'profile_views') stats.platformInsights.instagram.profileViews  = val;
                }
            }

            if (interactRes.status === 'fulfilled') {
                const totals = interactRes.value.data?.data?.[0]?.total_value?.breakdowns?.[0];
                if (totals) {
                    // total_value format varies; parse results array
                    const results = interactRes.value.data?.data || [];
                    for (const m of results) {
                        const v = m.total_value?.value || m.values?.[0]?.value || 0;
                        if (m.name === 'total_interactions') stats.platformInsights.instagram.totalInteractions = v;
                        if (m.name === 'likes')              stats.platformInsights.instagram.likes             = v;
                        if (m.name === 'comments')           stats.platformInsights.instagram.comments          = v;
                        if (m.name === 'saves')              stats.platformInsights.instagram.saves             = v;
                        if (m.name === 'shares')             stats.platformInsights.instagram.shares            = v;
                    }
                } else {
                    // Fallback: extract from data array directly
                    for (const m of interactRes.value.data?.data || []) {
                        const v = m.total_value?.value ?? m.values?.[0]?.value ?? 0;
                        if (m.name === 'total_interactions') stats.platformInsights.instagram.totalInteractions = v;
                        if (m.name === 'likes')              stats.platformInsights.instagram.likes             = v;
                        if (m.name === 'comments')           stats.platformInsights.instagram.comments          = v;
                        if (m.name === 'saves')              stats.platformInsights.instagram.saves             = v;
                        if (m.name === 'shares')             stats.platformInsights.instagram.shares            = v;
                    }
                }
            }

            stats.platformInsights.instagram.available = true;
            console.log(`  ✅ IG Insights: reach=${stats.platformInsights.instagram.weeklyReach}, likes=${stats.platformInsights.instagram.likes}, comments=${stats.platformInsights.instagram.comments}`);
        } catch (e) {
            console.error('  ❌ IG Insights:', e.response?.data?.error?.message || e.message);
        }
    }

    // ─── 6. X (TWITTER) ──────────────────────────────────────────────────────
    // Free tier: v1.1 statuses/user_timeline is not available.
    // We get followers via /1.1/users/show.json (works on free tier with OAuth 1.0a)
    // Tweet analytics (impressions, likes, retweets) come from our own post_log.
    try {
        const consumerKey    = process.env.TWITTER_CONSUMER_KEY;
        const consumerSecret = process.env.TWITTER_CONSUMER_SECRET;
        const accessToken    = process.env.TWITTER_ACCESS_TOKEN;
        const tokenSecret    = process.env.TWITTER_TOKEN_SECRET;
        const username       = 'HashSYR24';

        if (consumerKey && consumerSecret && accessToken && tokenSecret) {
            const crypto = require('crypto');

            function oauthSign(method, url, params) {
                const ts    = Math.floor(Date.now() / 1000).toString();
                const nonce = crypto.randomBytes(16).toString('hex');
                const op = {
                    oauth_consumer_key:     consumerKey,
                    oauth_nonce:            nonce,
                    oauth_signature_method: 'HMAC-SHA1',
                    oauth_timestamp:        ts,
                    oauth_token:            accessToken,
                    oauth_version:          '1.0'
                };
                const all = { ...params, ...op };
                const sorted = Object.keys(all).sort()
                    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(all[k])}`).join('&');
                const base = [method.toUpperCase(), encodeURIComponent(url), encodeURIComponent(sorted)].join('&');
                const key  = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
                op.oauth_signature = crypto.createHmac('sha1', key).update(base).digest('base64');
                return 'OAuth ' + Object.keys(op).sort()
                    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(op[k])}"`).join(', ');
            }

            // /1.1/users/show.json works on free tier
            const userUrl    = 'https://api.twitter.com/1.1/users/show.json';
            const userParams = { screen_name: username };
            const userAuth   = oauthSign('GET', userUrl, userParams);
            const userRes    = await axios.get(userUrl, { params: userParams, headers: { Authorization: userAuth } });
            const u = userRes.data;
            stats.platforms.x.followers = u.followers_count || 0;
            stats.platforms.x.connected = true;

            // Surface what we can from user object
            stats.platformInsights.x.available          = true;
            stats.platformInsights.x.weeklyLikes        = 0; // requires Basic plan
            stats.platformInsights.x.weeklyRetweets     = 0;
            stats.platformInsights.x.weeklyImpressions  = 0;
            stats.platformInsights.x.note               = 'Tweet impressions/engagement require X Basic API plan';
            console.log(`  ✅ X: ${u.followers_count} followers (tweet analytics require paid plan)`);
        }
    } catch (e) {
        stats.platforms.x.connected = !!process.env.TWITTER_ACCESS_TOKEN;
        const msg = e.response?.data?.errors?.[0]?.message || e.response?.data?.error || e.message;
        console.error('  ❌ X:', msg?.substring(0, 100));
    }

    // ─── 7. CORE KPIs ────────────────────────────────────────────────────────
    stats.kpis.totalAudience = Object.values(stats.platforms).reduce((s, p) => s + (p.followers || 0), 0);

    try {
        if (fs.existsSync(HISTORY_PATH)) {
            const history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
            stats.kpis.postsPublished = Array.isArray(history)
                ? history.filter(h => !h.startsWith('slot_') && !h.startsWith('routine_') && !h.startsWith('pillar_')).length
                : 0;
        }
    } catch (_) {}

    try {
        if (fs.existsSync(MEMORY_PATH)) {
            const memory = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
            stats.kpis.storyLibrary = Array.isArray(memory) ? memory.length : 0;
        }
    } catch (_) {}

    try {
        if (fs.existsSync(POST_LOG_PATH)) {
            const postLog = JSON.parse(fs.readFileSync(POST_LOG_PATH, 'utf8'));
            const today   = getTodayStr();
            stats.kpis.postsToday = postLog[today]?.count || 0;
            const weekly = {};
            for (let i = 6; i >= 0; i--) {
                const d = new Date(); d.setDate(d.getDate() - i);
                const k = d.toISOString().split('T')[0];
                weekly[k] = postLog[k]?.count || 0;
            }
            stats.kpis.weeklyPostCounts = weekly;
        }
    } catch (_) {}

    // ─── 8. CONTENT PILLARS ──────────────────────────────────────────────────
    try {
        if (fs.existsSync(SCHEDULE_CONFIG_PATH)) {
            const sc = JSON.parse(fs.readFileSync(SCHEDULE_CONFIG_PATH, 'utf8'));
            const pillars = sc.content_pillars?.pillars || [];
            const history = fs.existsSync(HISTORY_PATH) ? JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8')) : [];
            const today   = getTodayStr();
            stats.contentPillars = pillars.map(p => ({
                id:            p.id,
                nameArabic:    p.name_arabic,
                frequency:     p.frequency,
                preferredTime: p.preferred_time || null,
                postedToday:   history.includes(`pillar_${p.id}_${today}`),
                template:      p.template
            }));
        }
    } catch (_) {}

    stats.pipeline.status  = 'operational';
    stats.pipeline.lastRun = new Date().toISOString();

    // ─── WRITE ────────────────────────────────────────────────────────────────
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf8');

    console.log(`\n✅ Stats written → ${STATS_FILE}`);
    console.log(`   Audience: ${stats.kpis.totalAudience} | Posts Today: ${stats.kpis.postsToday} | Library: ${stats.kpis.storyLibrary}`);
    console.log(`   FB: views=${stats.platformInsights.facebook.weeklyViews} engaged=${stats.platformInsights.facebook.weeklyEngaged} likes=${stats.platformInsights.facebook.postsLikes} comments=${stats.platformInsights.facebook.postsComments} shares=${stats.platformInsights.facebook.postsShares}`);
    console.log(`   IG: reach=${stats.platformInsights.instagram.weeklyReach} interactions=${stats.platformInsights.instagram.totalInteractions}`);
    console.log(`   X:  likes=${stats.platformInsights.x.weeklyLikes} RTs=${stats.platformInsights.x.weeklyRetweets}`);
}

if (require.main === module) { fetchStats(); }
module.exports = fetchStats;
