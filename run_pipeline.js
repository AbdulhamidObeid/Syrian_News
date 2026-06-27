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

const lockfile = require('fs');
const LOCK_FILE = path.join(__dirname, 'engine.lock');
try {
    if (lockfile.existsSync(LOCK_FILE)) {
        const pid = lockfile.readFileSync(LOCK_FILE, 'utf8');
        try {
            process.kill(pid, 0);
            console.error('⚠️ Engine is already running (PID: ' + pid + '). Exiting to prevent duplicates.');
            process.exit(1);
        } catch (e) {
            // Process is dead, safe to remove lock
            lockfile.unlinkSync(LOCK_FILE);
        }
    }
    lockfile.writeFileSync(LOCK_FILE, process.pid.toString());
} catch (e) {}

// Clean up lock on exit
['exit', 'SIGINT', 'SIGTERM'].forEach(sig => {
    process.on(sig, () => {
        try { lockfile.unlinkSync(LOCK_FILE); } catch(e) {}
        if (sig !== 'exit') process.exit();
    });
});

const { execSync } = require('child_process');

// Require the Engine Modules
const { runCurator, refineCopywriteNewsItem, refineImagePrompt } = require('./Agent_Scripts/Editor_Engine/curator');
const { generatePost } = require('./Agent_Scripts/Designer_Engine/generate_post');
const { sendForApproval, publishToChannel, sendErrorAlert, startBot, stopBot, registerBoostCommand, isApprovalPending, sendAdminNotification } = require('./Agent_Scripts/Telegram_Engine/telegram_admin');
const { publishPost } = require('./Agent_Scripts/Publisher_Engine/poster');

const FEED_PATH = path.join(__dirname, 'Agent_Scripts/Scout_Engine/feed.json');
const TEMP_FEED_PATH = path.join(__dirname, 'Agent_Scripts/Scout_Engine/temp_feed.json');
const COPY_INPUT_DIR = path.join(__dirname, 'Agent_Scripts/Designer_Engine/copy_input');
const IMAGE_OUTPUT_DIR = path.join(__dirname, 'Agent_Scripts/Designer_Engine/output');
const TEMP_RUN_DIR = path.join(__dirname, 'Agent_Scripts/Designer_Engine/temp_run');
const MEMORY_PATH = path.join(__dirname, 'memory.json');
const HISTORY_PATH = path.join(__dirname, 'posted_history.json');
const RECENT_TOPICS_PATH = path.join(__dirname, 'recent_topics.json');
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
        // OVERFLOW QUOTA LOGIC: If the best post in memory is extremely vital (score >= 9.0), allow it to bypass the daily cap.
        const mem = loadJson(path.join(__dirname, 'memory.json'));
        const bestMemPost = mem.find(m => !m.isUrgent);
        if (bestMemPost && bestMemPost.score >= 9.0) {
            console.log(`🚀 Overflow Quota Granted! Vital news (Score: ${bestMemPost.score}) is bypassing the daily cap of ${rules.max_posts_per_day}.`);
        } else {
            console.log(`🛑 Daily cap reached (${todayLog.count}/${rules.max_posts_per_day}). No more posts today.`);
            return false;
        }
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

function cleanupPostFiles(postId) {
    console.log(`\n🧹 Cleaning up files for Post ID: ${postId}...`);
    try {
        // 1. Delete payload file from Designer_Engine/copy_input
        const payloadPath = path.join(COPY_INPUT_DIR, `post_${postId}.json`);
        if (fs.existsSync(payloadPath)) {
            try { fs.unlinkSync(payloadPath); } catch (e) { console.warn(`Failed to delete payload: ${e.message}`); }
        }
        
        // 2. Delete main image and rendered HTML files from Designer_Engine/temp_run
        if (fs.existsSync(TEMP_RUN_DIR)) {
            const files = fs.readdirSync(TEMP_RUN_DIR);
            for (const file of files) {
                if (file.includes(postId)) {
                    try { fs.unlinkSync(path.join(TEMP_RUN_DIR, file)); } catch (e) {}
                }
            }
        }
        
        // 3. Delete generated images/videos from Designer_Engine/output
        if (fs.existsSync(IMAGE_OUTPUT_DIR)) {
            const files = fs.readdirSync(IMAGE_OUTPUT_DIR);
            for (const file of files) {
                if (file.includes(postId)) {
                    try { fs.unlinkSync(path.join(IMAGE_OUTPUT_DIR, file)); } catch (e) {}
                }
            }
        }
        console.log(`🧹 Cleanup complete for Post ID: ${postId}.`);
    } catch (e) {
        console.error(`⚠️ Error during post cleanup:`, e.message);
    }
}

function syncCopyInputFolder(activeMemory) {
    try {
        if (!fs.existsSync(COPY_INPUT_DIR)) return;
        const activeFiles = new Set(activeMemory.map(item => `post_${item.originalId}.json`));
        const files = fs.readdirSync(COPY_INPUT_DIR);
        const now = Date.now();
        const ttlMs = 24 * 60 * 60 * 1000;
        
        for (const file of files) {
            if (file.startsWith('post_') && file.endsWith('.json')) {
                // Keep active post files
                if (activeFiles.has(file)) continue;

                // Handle routine files (keep only if created in last 24h)
                if (file.startsWith('post_routine_')) {
                    const stats = fs.statSync(path.join(COPY_INPUT_DIR, file));
                    if ((now - stats.mtimeMs) < ttlMs) {
                        continue;
                    }
                }

                // Delete orphaned file
                try {
                    fs.unlinkSync(path.join(COPY_INPUT_DIR, file));
                    console.log(`🧹 Deleted orphaned input file: ${file}`);
                } catch (e) {}
            }
        }
    } catch (e) {
        console.error(`⚠️ Error synchronizing copy_input folder:`, e.message);
    }
}

let isProcessingAnyPost = false;

// ---- CORE PROCESSING ----

async function processPost(post, countQuota = true) {
    if (isProcessingAnyPost) {
        console.log(`⚠️ processPost called but another post is already processing. Aborting to prevent race condition.`);
        return false;
    }
    isProcessingAnyPost = true;
    let shouldCleanup = false;
    try {
        console.log(`\n🎨 Processing Post ID: ${post.originalId} (Score: ${post.score})`);
        const payloadPath = path.join(COPY_INPUT_DIR, `post_${post.originalId}.json`);
        
        if (!fs.existsSync(COPY_INPUT_DIR)) fs.mkdirSync(COPY_INPUT_DIR, { recursive: true });
        fs.writeFileSync(payloadPath, JSON.stringify(post.payload, null, 2));

        let currentPayload = post.payload;
        let imagePaths = [];

        while (true) {
            let designSuccess = false;
            
            // Ensure old images are deleted if we are re-generating
            const tempImage = path.join(__dirname, 'Agent_Scripts/Designer_Engine/temp_run', `main_image_${post.originalId}.jpg`);
            if (fs.existsSync(tempImage)) {
                try { fs.unlinkSync(tempImage); } catch (e) {}
            }

            if (fs.existsSync(IMAGE_OUTPUT_DIR)) {
                const files = fs.readdirSync(IMAGE_OUTPUT_DIR);
                for (const file of files) {
                    if (file.startsWith(`post_${post.originalId}`)) {
                        try { fs.unlinkSync(path.join(IMAGE_OUTPUT_DIR, file)); } catch (e) {}
                    }
                }
            }

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
                        shouldCleanup = true;
                        return false;
                    }
                }
            }

            console.log(`\n📲 Sending to Telegram Admin for Approval...`);
            let approvalStatus = null;
            try {
                approvalStatus = await sendForApproval(imagePaths, currentPayload.socialMediaCaptionLong, currentPayload.socialMediaCaptionShort, "All Platforms");
            } catch (err) {
                console.error(`❌ Telegram send failed:`, err);
                shouldCleanup = true;
                return false;
            }

            if (approvalStatus.action === 'approve') {
                console.log(`✅ Post ${post.originalId} APPROVED! Broadcasting...`);
                await publishToChannel(imagePaths, currentPayload.socialMediaCaptionLong);
                await publishPost(imagePaths, currentPayload.socialMediaCaptionLong, currentPayload.socialMediaCaptionShort, post.originalId, sendErrorAlert);
                
                // Add to history and remove from memory ONLY after successful publishing!
                let currentHistory = loadJson(HISTORY_PATH);
                if (!currentHistory.includes(post.originalId)) {
                    currentHistory.push(post.originalId);
                    saveJson(HISTORY_PATH, currentHistory);
                }
                let currentMemory = loadJson(MEMORY_PATH);
                currentMemory = currentMemory.filter(m => String(m.originalId) !== String(post.originalId));
                saveJson(MEMORY_PATH, currentMemory);

                if (countQuota) {
                    recordPost();
                    
                    // Add to recent topics
                    let activeTopics = fs.existsSync(RECENT_TOPICS_PATH) ? loadJson(RECENT_TOPICS_PATH) : [];
                    const topicStr = (post.payload?.headline?.line1 || "") + " " + (post.payload?.headline?.line2 || "");
                    if (topicStr.trim().length > 0) {
                        activeTopics.unshift(topicStr);
                        if (activeTopics.length > 50) activeTopics.length = 50;
                        saveJson(RECENT_TOPICS_PATH, activeTopics);
                    }
                } else {
                    console.log('(🚀 Override post — published without consuming quota slot.)');
                }
                shouldCleanup = true;
                return true;
            } else if (approvalStatus.action === 'reject') {
                console.log(`🗑️ Post REJECTED by Admin. Discarding.`);
                
                // Remove from memory immediately since it was rejected
                let currentMemory = loadJson(MEMORY_PATH);
                currentMemory = currentMemory.filter(m => String(m.originalId) !== String(post.originalId));
                saveJson(MEMORY_PATH, currentMemory);
                
                shouldCleanup = true;
                return false;

            // ---- One-click agent rerun (no text feedback) ----
            } else if (approvalStatus.action === 'rerun_from' && approvalStatus.agent === 'designer') {
                if (approvalStatus.imageModel) {
                    // Model switch requested — stamp the new model onto the payload so generate_post uses it
                    console.log(`🔄 Switching image model to: ${approvalStatus.imageModel}`);
                    currentPayload.imageModel = approvalStatus.imageModel;
                    fs.writeFileSync(payloadPath, JSON.stringify(currentPayload, null, 2));
                } else {
                    console.log(`🎨 Admin requested Designer rerun — regenerating image with existing prompt.`);
                }
                // The image cleanup at the top of the while-loop handles deleting temp/output files.
                // Just loop back — generatePost will re-run with the updated payload.

            } else if (approvalStatus.action === 'rerun_from' && approvalStatus.agent === 'writer') {
                console.log(`✍️ Admin requested Writer rerun — rewriting content with original source data.`);
                try {
                    const rawFeed = loadJson(FEED_PATH);
                    const originalItem = rawFeed.find(item => String(item.id) === String(post.originalId)) || {
                        id: post.originalId,
                        title: currentPayload.headline ? currentPayload.headline.line1 : "",
                        description: currentPayload.points ? currentPayload.points.join(" ") : ""
                    };
                    // Rewrite from scratch (empty feedback string signals a clean rerun)
                    const refinedPayload = await refineCopywriteNewsItem(originalItem, currentPayload, 'Rewrite the entire post fresh — keep the same news story but generate new phrasing, headline, and copy.');
                    currentPayload = refinedPayload;
                    fs.writeFileSync(payloadPath, JSON.stringify(refinedPayload, null, 2));
                    console.log("📝 Writer rerun complete — payload updated.");
                } catch (err) {
                    console.error("❌ Writer rerun failed:", err);
                }

            // ---- Custom feedback (text-based modifications) ----
            } else if (approvalStatus.action === 'modify_writer') {
                console.log(`✍️ Admin requested content/caption modifications: "${approvalStatus.feedback}"`);
                
                try {
                    const rawFeed = loadJson(FEED_PATH);
                    const originalItem = post.originalItem || rawFeed.find(item => String(item.id) === String(post.originalId)) || {
                        id: post.originalId,
                        title: currentPayload.headline ? currentPayload.headline.line1 : "",
                        description: currentPayload.points ? currentPayload.points.join(" ") : ""
                    };
                    
                    const refinedPayload = await refineCopywriteNewsItem(originalItem, currentPayload, approvalStatus.feedback);
                    currentPayload = refinedPayload;
                    fs.writeFileSync(payloadPath, JSON.stringify(refinedPayload, null, 2));
                    console.log("📝 Payload updated with refined content.");
                } catch (err) {
                    console.error("❌ Refinement failed:", err);
                    await sendAdminNotification(`❌ <b>Writer Refinement Failed:</b>\n${err.message || err}\n\nReverting to previous post copy.`);
                }
            } else if (approvalStatus.action === 'modify_designer') {
                console.log(`🎨 Admin requested image modifications: "${approvalStatus.feedback}"`);
                
                try {
                    const newPrompt = await refineImagePrompt(currentPayload, approvalStatus.feedback);
                    console.log(`✨ Refined Image Prompt: "${newPrompt}"`);
                    
                    currentPayload.imagePrompt = newPrompt;
                    if (currentPayload.isCarousel && currentPayload.slides && currentPayload.slides[0]) {
                        currentPayload.slides[0].imagePrompt = newPrompt;
                    }
                    
                    fs.writeFileSync(payloadPath, JSON.stringify(currentPayload, null, 2));
                } catch (err) {
                    console.error("❌ Image prompt refinement failed:", err);
                    await sendAdminNotification(`❌ <b>Designer Refinement Failed:</b>\n${err.message || err}\n\nReverting to previous image prompt.`);
                }
            } // end else if
        } // end while (true)
    } finally {
        isProcessingAnyPost = false;
        if (shouldCleanup) {
            cleanupPostFiles(post.originalId);
        }
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
        console.log("📊 Updating dashboard statistics...");
        try {
            execSync(`node ${path.join(__dirname, 'Dashboard/update_stats.js')}`, { stdio: 'inherit' });
        } catch (e) {
            console.error("⚠️ Failed to update stats:", e.message);
        }

        const scheduleConfig = JSON.parse(fs.readFileSync(SCHEDULE_CONFIG_PATH, 'utf8'));
        let memory = loadJson(MEMORY_PATH);
        const history = loadJson(HISTORY_PATH);

        // 1. Cleanup Memory (> 24 hours old)
        const ttlMs = (scheduleConfig.news_memory_ttl_hours || 24) * 60 * 60 * 1000;
        const now = Date.now();
        const activeMemory = [];
        const expiredMemory = [];
        for (const item of memory) {
            if ((now - item.fetchedAt) < ttlMs) {
                activeMemory.push(item);
            } else {
                expiredMemory.push(item);
            }
        }
        memory = activeMemory;
        if (expiredMemory.length > 0) {
            console.log(`🧹 Cleaning up ${expiredMemory.length} expired posts (> 24 hours old)...`);
            for (const item of expiredMemory) {
                cleanupPostFiles(item.originalId);
            }
        }
        syncCopyInputFolder(memory);


        // 2. Run Scout — pull fresh news
        console.log("📡 Triggering Scout Engine...");
        execSync(`node ${path.join(__dirname, 'Agent_Scripts/Scout_Engine/scout.js')}`, { stdio: 'inherit' });
        
        let newFeed = loadJson(FEED_PATH);
        newFeed = newFeed.filter(item => 
            !memory.find(m => m.originalId === item.id) && 
            !history.includes(item.id)
        );

        const URGENT_KEYWORDS = ["عاجل", "مرسوم", "قرار رئاسي", "انفجار", "عقوبات", "زلزال", "توغل", "قصف", "غارة", "غارات", "اشتباك", "اشتباكات", "اغتيال", "استهداف", "أمني", "أمنية", "عسكري", "صاروخ", "صواريخ", "مسيرة", "مسيرات", "breaking", "خبر عاجل"];
        const hasUrgentKeyword = newFeed.some(item => URGENT_KEYWORDS.some(kw => (item.title && item.title.includes(kw)) || (item.description && item.description.includes(kw))));
        
        let postLog = loadPostLog();
        const lastCuratorRunAt = postLog.lastCuratorRunAt || 0;
        const oneHourMs = 60 * 60 * 1000;
        const shouldRunCurator = (Date.now() - lastCuratorRunAt >= oneHourMs) || hasUrgentKeyword;

        if (newFeed.length > 0 && shouldRunCurator) {
            saveJson(TEMP_FEED_PATH, newFeed);
            console.log(`\n✍️ Triggering Editor Engine for ${newFeed.length} new articles...`);
            
            postLog = loadPostLog();
            postLog.lastCuratorRunAt = Date.now();
            savePostLog(postLog);
            
            // Build a list of active and recently published topics to prevent semantic duplication
            let recentTopics = fs.existsSync(RECENT_TOPICS_PATH) ? loadJson(RECENT_TOPICS_PATH) : [];
            const memoryTopics = memory.map(m => (m.payload?.headline?.line1 || "") + " " + (m.payload?.headline?.line2 || "")).filter(t => t.trim().length > 0);
            const allActiveTopics = [...recentTopics, ...memoryTopics];

            const curatedPayloads = await runCurator(TEMP_FEED_PATH, COPY_INPUT_DIR, allActiveTopics);
            
            for (const c of curatedPayloads) {
                c.fetchedAt = Date.now();
                memory.push(c);
            }
        } else if (newFeed.length > 0 && !shouldRunCurator) {
            console.log(`⏳ Batching ${newFeed.length} new articles for the next hourly curation run (saves RPD).`);
        } else {
            console.log("😴 No new articles found by Scout.");
        }

        // Sort memory by score descending
        memory.sort((a, b) => b.score - a.score);

        // Sync copy_input folder to ensure it matches memory perfectly
        syncCopyInputFolder(memory);

        saveJson(MEMORY_PATH, memory);

        const currentTime = getDamascusTime();
        console.log(`\n📦 Memory: ${memory.length} curated posts available.`);

        // 3. Process URGENT posts immediately (bypass all limits)
        let currentMemoryForUrgent = loadJson(MEMORY_PATH);
        const urgentPosts = currentMemoryForUrgent.filter(m => m.isUrgent);
        for (const upost of urgentPosts) {
            console.log(`🚨 Processing URGENT Post: ${upost.originalId}`);
            // Remove from memory immediately to prevent concurrent cycles picking it up
            currentMemoryForUrgent = loadJson(MEMORY_PATH).filter(m => m.originalId !== upost.originalId);
            saveJson(MEMORY_PATH, currentMemoryForUrgent);

            // Add to history BEFORE processing
            let currentHistory = loadJson(HISTORY_PATH);
            if(!currentHistory.includes(upost.originalId)) {
                currentHistory.push(upost.originalId);
                saveJson(HISTORY_PATH, currentHistory);
            }

            const published = await processPost(upost);
        }

        // 4. Check Routine Carousels
        if (scheduleConfig.routine_posts && scheduleConfig.routine_posts.enabled) {
            // Morning routine
            const morning = scheduleConfig.routine_posts.morning;
            if (morning && isTimeWithinWindow(currentTime, morning.time, morning.window_minutes || 20)) {
                const routineId = `routine_morning_${getTodayDateStr()}`;
                let currentHistory = loadJson(HISTORY_PATH);
                if (!currentHistory.includes(routineId)) {
                    currentHistory.push(routineId);
                    saveJson(HISTORY_PATH, currentHistory);
                    const published = await runRoutineCarousel(morning, routineId);
                }
            }
            // Evening routine
            const evening = scheduleConfig.routine_posts.evening;
            if (evening && isTimeWithinWindow(currentTime, evening.time, evening.window_minutes || 20)) {
                const routineId = `routine_evening_${getTodayDateStr()}`;
                let currentHistory = loadJson(HISTORY_PATH);
                if (!currentHistory.includes(routineId)) {
                    currentHistory.push(routineId);
                    saveJson(HISTORY_PATH, currentHistory);
                    const published = await runRoutineCarousel(evening, routineId);
                }
            }
        }

        // 5. Check Nightly Evaluator
        const currentHourMin = getDamascusTime();
        if (isTimeWithinWindow(currentHourMin, "23:30", 10)) {
            const evalId = `eval_${getTodayDateStr()}`;
            let currentHistory = loadJson(HISTORY_PATH);
            if (!currentHistory.includes(evalId)) {
                currentHistory.push(evalId);
                saveJson(HISTORY_PATH, currentHistory);
                console.log("🌙 Triggering Nightly Evaluator...");
                try {
                    execSync(`node ${path.join(__dirname, 'Agent_Scripts/Nightly_Evaluator/nightly_evaluator.js')}`, { stdio: 'inherit' });
                } catch(e) {
                    console.error("❌ Nightly Evaluator failed:", e.message);
                }
            }
        }

        // 6. AGGRESSIVE POSTING — Post the best available content if allowed
        if (isApprovalPending()) {
            console.log(`⏳ Admin approval is currently pending for a previous post. Halting non-urgent posts until resolved.`);
        } else if (canPostNow(scheduleConfig)) {
            let currentMemory = loadJson(MEMORY_PATH);
            const bestPost = currentMemory.find(m => !m.isUrgent);
            if (bestPost) {
                console.log(`⚡ Best post available: "${bestPost.originalId}" (Score: ${bestPost.score}). Posting now!`);
                const published = await processPost(bestPost);
            } else {
                console.log("📭 No posts in memory to publish right now.");
            }
        }

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

// ---- Register /postnow Override Publish ----
let isProcessingBoost = false;

registerBoostCommand(async (ctx, postId) => {
    console.log(`\n🛎️ Override Publish requested for Post ID: ${postId}! Checking locks...`);
    if (isProcessingBoost || isProcessingAnyPost) {
        console.log(`⚠️ Locked! isProcessingBoost=${isProcessingBoost}, isProcessingAnyPost=${isProcessingAnyPost}`);
        return ctx.reply('⚠️ Please wait! The engine is currently generating another post. Running them together will mix up the images.');
    }
    console.log(`🔓 Locks cleared! Proceeding with override...`);
    isProcessingBoost = true;
    
    try {
        let memory = loadJson(MEMORY_PATH);

        // Find the selected story in the library
        const overridePost = memory.find(m => String(m.originalId) === String(postId));
        if (!overridePost) {
            return ctx.reply('💭 Selected story is no longer in the library. Please try again.');
        }

        console.log(`\n🚀 OVERRIDE PUBLISH triggered via /postnow for Post ID: ${postId}`);
        console.log(`📌 Using story: ${overridePost.originalId} (Score: ${overridePost.score})`);

        // Process it — countQuota=false so it doesn't burn a quota slot
        const published = await processPost(overridePost, false);

        if (published) {
            console.log(`✅ Override publish complete for ${overridePost.originalId}.`);
        }
    } finally {
        isProcessingBoost = false;
    }
});

if (args.includes('--run-now')) {
    runCycle().then(() => {
        stopBot();
        process.exit(0);
    });
} else {
    console.log("🟢 HashSYR24 Growth Engine Online (24/7 — every 15 mins).");
    console.log("📋 Rules: 45min gap | 12 posts/day cap | Prime 07:00-23:00 Damascus");
    console.log("📡 Platforms: Facebook · Instagram · X · Telegram");
    runCycle();
    const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
    setInterval(runCycle, INTERVAL_MS);
}
