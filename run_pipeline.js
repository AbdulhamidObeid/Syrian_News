/**
 * run_pipeline.js
 * 
 * The Master Orchestrator for HashSYR24 — Aggressive Growth Mode.
 * 
 * NO fixed slots. Posts immediately when quality content is found.
 * Respects minimum gap (45 min), daily cap (12), and prime hours.
 * Runs every 15 minutes, 24/7.
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Require the Engine Modules
const { runCurator } = require('./Agent_Scripts/Editor_Engine/curator');
const { generatePost } = require('./Agent_Scripts/Designer_Engine/generate_post');
const { sendForApproval, publishToChannel, sendErrorAlert, startBot, stopBot } = require('./Agent_Scripts/Telegram_Engine/telegram_admin');
const { publishPost } = require('./Agent_Scripts/Publisher_Engine/poster');

const FEED_PATH = path.join(__dirname, 'Agent_Scripts/Scout_Engine/feed.json');
const TEMP_FEED_PATH = path.join(__dirname, 'Agent_Scripts/Scout_Engine/temp_feed.json');
const COPY_INPUT_DIR = path.join(__dirname, 'Agent_Scripts/Designer_Engine/copy_input');
const IMAGE_OUTPUT_DIR = path.join(__dirname, 'Agent_Scripts/Designer_Engine/output');
const MEMORY_PATH = path.join(__dirname, 'memory.json');
const HISTORY_PATH = path.join(__dirname, 'posted_history.json');
const SCHEDULE_CONFIG_PATH = path.join(__dirname, 'Config/schedule_config.json');
const POST_LOG_PATH = path.join(__dirname, 'post_log.json');

// ---- UTILITY FUNCTIONS ----

function getDamascusTime() {
    const d = new Date();
    const damascus = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Damascus' }));
    const hh = String(damascus.getHours()).padStart(2, '0');
    const mm = String(damascus.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

function getDamascusHour() {
    const d = new Date();
    const damascus = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Damascus' }));
    return damascus.getHours();
}

function isTimeWithinWindow(time1, time2, windowMinutes = 20) {
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);
    const t1 = h1 * 60 + m1;
    const t2 = h2 * 60 + m2;
    return Math.abs(t1 - t2) <= windowMinutes;
}

function loadJson(p) { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : []; }
function saveJson(p, data) { fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8'); }

function getTodayDateStr() {
    return new Date().toISOString().split('T')[0];
}

/**
 * Load post log — tracks timestamps and counts per day for rate limiting.
 * Format: { "2026-06-18": { count: 3, lastPostAt: 1718712345000 } }
 */
function loadPostLog() {
    if (fs.existsSync(POST_LOG_PATH)) {
        return JSON.parse(fs.readFileSync(POST_LOG_PATH, 'utf8'));
    }
    return {};
}

function savePostLog(log) {
    fs.writeFileSync(POST_LOG_PATH, JSON.stringify(log, null, 2), 'utf8');
}

function canPostNow(scheduleConfig) {
    const postLog = loadPostLog();
    const today = getTodayDateStr();
    const todayLog = postLog[today] || { count: 0, lastPostAt: 0 };
    const rules = scheduleConfig.posting_rules;

    // Check daily cap
    if (todayLog.count >= rules.max_posts_per_day) {
        console.log(`🛑 Daily cap reached (${todayLog.count}/${rules.max_posts_per_day}). No more posts today.`);
        return false;
    }

    // Check minimum gap
    const minGapMs = rules.min_gap_minutes * 60 * 1000;
    const timeSinceLastPost = Date.now() - todayLog.lastPostAt;
    if (todayLog.lastPostAt > 0 && timeSinceLastPost < minGapMs) {
        const waitMins = Math.ceil((minGapMs - timeSinceLastPost) / 60000);
        console.log(`⏳ Minimum gap not met. Wait ${waitMins} more minutes.`);
        return false;
    }

    // Check prime hours
    if (!rules.off_hours_allowed) {
        const hour = getDamascusHour();
        const [startH] = rules.prime_hours.start.split(':').map(Number);
        const [endH] = rules.prime_hours.end.split(':').map(Number);
        if (hour < startH || hour >= endH) {
            console.log(`🌙 Outside prime hours (${rules.prime_hours.start}-${rules.prime_hours.end}). Skipping.`);
            return false;
        }
    }

    return true;
}

function recordPost() {
    const postLog = loadPostLog();
    const today = getTodayDateStr();
    if (!postLog[today]) postLog[today] = { count: 0, lastPostAt: 0 };
    postLog[today].count++;
    postLog[today].lastPostAt = Date.now();
    savePostLog(postLog);
    console.log(`📊 Posts today: ${postLog[today].count}`);
}

// ---- CORE PROCESSING ----

async function processPost(post) {
    console.log(`\n🎨 Processing Post ID: ${post.originalId} (Score: ${post.score})`);
    const payloadPath = path.join(COPY_INPUT_DIR, `post_${post.originalId}.json`);
    
    if (!fs.existsSync(COPY_INPUT_DIR)) fs.mkdirSync(COPY_INPUT_DIR, { recursive: true });
    fs.writeFileSync(payloadPath, JSON.stringify(post.payload, null, 2));

    let imagePaths = [];
    let designSuccess = false;
    
    while (!designSuccess) {
        try {
            imagePaths = await generatePost(payloadPath, IMAGE_OUTPUT_DIR);
            if (!imagePaths || imagePaths.length === 0) throw new Error("Image generation returned empty.");
            designSuccess = true;
        } catch (err) {
            console.error(`❌ Designer failed for Post ${post.originalId}:`, err);
            const alertResponse = await sendErrorAlert(err.message, post.originalId, "Check Higgsfield/Chrome. Click Retry.");
            if (alertResponse.action === 'skip') {
                console.log(`⏭️ Admin chose to skip post ${post.originalId}.`);
                return false;
            }
        }
    }

    console.log(`\n📲 Sending to Telegram Admin for Approval...`);
    let approvalStatus = null;
    try {
        approvalStatus = await sendForApproval(imagePaths, post.payload.socialMediaCaptionLong, post.payload.socialMediaCaptionShort, "All Platforms");
    } catch (err) {
        console.error(`❌ Telegram send failed:`, err);
        return false;
    }

    if (approvalStatus.action === 'approve') {
        console.log(`✅ Post ${post.originalId} APPROVED! Broadcasting...`);
        await publishToChannel(imagePaths, post.payload.socialMediaCaptionLong);
        await publishPost(imagePaths, post.payload.socialMediaCaptionLong, post.payload.socialMediaCaptionShort);
        recordPost();
        return true;
    } else if (approvalStatus.action === 'modify') {
        console.log(`✍️ Admin requested modifications: "${approvalStatus.feedback}". (Needs Editor regeneration)`);
        return false;
    } else {
        console.log(`🗑️ Post REJECTED by Admin. Discarding.`);
        return false;
    }
}

async function runRoutineCarousel(routineConfig, routineId) {
    console.log(`🌞 Triggering Routine Carousel: ${routineId}...`);
    try {
        execSync(`node ${path.join(__dirname, 'Agent_Scripts/Scout_Engine/routine_scout.js')}`, { stdio: 'inherit' });
        const routinePath = path.join(COPY_INPUT_DIR, 'post_routine_daily.json');
        if (fs.existsSync(routinePath)) {
            const routinePayload = JSON.parse(fs.readFileSync(routinePath, 'utf8'));
            const postObj = { originalId: routineId, score: 10, isUrgent: false, payload: routinePayload };
            const published = await processPost(postObj);
            return published;
        }
    } catch(e) {
        console.error("Routine generation failed:", e);
    }
    return false;
}

// ---- MAIN CYCLE ----

async function runCycle() {
    console.log("\n=======================================================");
    console.log(`🚀 [Aggressive Growth Engine] Cycle Start - ${new Date().toLocaleString()} (Damascus: ${getDamascusTime()})`);
    console.log("=======================================================\n");

    try {
        const scheduleConfig = JSON.parse(fs.readFileSync(SCHEDULE_CONFIG_PATH, 'utf8'));
        let memory = loadJson(MEMORY_PATH);
        const history = loadJson(HISTORY_PATH);

        // 1. Cleanup Memory (> 24 hours old)
        const ttlMs = (scheduleConfig.news_memory_ttl_hours || 24) * 60 * 60 * 1000;
        memory = memory.filter(m => (Date.now() - m.fetchedAt) < ttlMs);

        // 2. Run Scout — pull fresh news
        console.log("📡 Triggering Scout Engine...");
        execSync(`node ${path.join(__dirname, 'Agent_Scripts/Scout_Engine/scout.js')}`, { stdio: 'inherit' });
        
        let newFeed = loadJson(FEED_PATH);
        newFeed = newFeed.filter(item => 
            !memory.find(m => m.originalId === item.id) && 
            !history.includes(item.id)
        );

        if (newFeed.length > 0) {
            saveJson(TEMP_FEED_PATH, newFeed);
            console.log(`\n✍️ Triggering Editor Engine for ${newFeed.length} new articles...`);
            const curatedPayloads = await runCurator(TEMP_FEED_PATH, COPY_INPUT_DIR);
            
            for (const c of curatedPayloads) {
                c.fetchedAt = Date.now();
                memory.push(c);
            }
        } else {
            console.log("😴 No new articles found by Scout.");
        }

        // Sort memory by score descending
        memory.sort((a, b) => b.score - a.score);
        saveJson(MEMORY_PATH, memory);

        const currentTime = getDamascusTime();
        console.log(`\n📦 Memory: ${memory.length} curated posts available.`);

        // 3. Process URGENT posts immediately (bypass all limits)
        const urgentPosts = memory.filter(m => m.isUrgent);
        for (const upost of urgentPosts) {
            console.log(`🚨 Processing URGENT Post: ${upost.originalId}`);
            const published = await processPost(upost);
            memory = memory.filter(m => m.originalId !== upost.originalId);
            history.push(upost.originalId);
        }

        // 4. Check Routine Carousels
        if (scheduleConfig.routine_posts && scheduleConfig.routine_posts.enabled) {
            // Morning routine
            const morning = scheduleConfig.routine_posts.morning;
            if (morning && isTimeWithinWindow(currentTime, morning.time, morning.window_minutes || 20)) {
                const routineId = `routine_morning_${getTodayDateStr()}`;
                if (!history.includes(routineId)) {
                    const published = await runRoutineCarousel(morning, routineId);
                    history.push(routineId);
                }
            }
            // Evening routine
            const evening = scheduleConfig.routine_posts.evening;
            if (evening && isTimeWithinWindow(currentTime, evening.time, evening.window_minutes || 20)) {
                const routineId = `routine_evening_${getTodayDateStr()}`;
                if (!history.includes(routineId)) {
                    const published = await runRoutineCarousel(evening, routineId);
                    history.push(routineId);
                }
            }
        }

        // 5. AGGRESSIVE POSTING — Post the best available content if allowed
        if (canPostNow(scheduleConfig)) {
            const bestPost = memory.find(m => !m.isUrgent);
            if (bestPost) {
                console.log(`⚡ Best post available: "${bestPost.originalId}" (Score: ${bestPost.score}). Posting now!`);
                const published = await processPost(bestPost);
                memory = memory.filter(m => m.originalId !== bestPost.originalId);
                history.push(bestPost.originalId);
            } else {
                console.log("📭 No posts in memory to publish right now.");
            }
        }

        // Save updated state
        saveJson(MEMORY_PATH, memory);
        saveJson(HISTORY_PATH, history);

    } catch (error) {
        console.error("❌ Master Loop Error:", error);
    }

    console.log("\n=======================================================");
    console.log(`⏸️ [Engine] Cycle Complete. Next cycle in 15 minutes.`);
    console.log("=======================================================\n");
}

// ---- STARTUP ----

const args = process.argv.slice(2);

startBot(); // start telegram bot listening

if (args.includes('--run-now')) {
    runCycle().then(() => {
        stopBot();
        process.exit(0);
    });
} else {
    console.log("🟢 HashSYR24 Aggressive Growth Engine Online (24/7 — every 15 mins).");
    console.log("📋 Rules: 45min gap | 12 posts/day cap | Prime 07:00-23:00 Damascus");
    runCycle();
    const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
    setInterval(runCycle, INTERVAL_MS);
}
