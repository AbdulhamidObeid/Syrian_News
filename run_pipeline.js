/**
 * run_pipeline.js
 * 
 * The Master Orchestrator for HashSYR24.
 * Links Scout, Editor, Designer, Telegram Admin, and Publisher.
 * Manages daily quotas, timeslots, memory (24h), and urgent news.
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

// Utility to get current Damascus time string "HH:mm"
function getDamascusTime() {
    const d = new Date();
    const damascus = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Damascus' }));
    const hh = String(damascus.getHours()).padStart(2, '0');
    const mm = String(damascus.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

// Utility to check if two "HH:mm" times are within a certain minute window
function isTimeWithinWindow(time1, time2, windowMinutes = 15) {
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);
    const t1 = h1 * 60 + m1;
    const t2 = h2 * 60 + m2;
    return Math.abs(t1 - t2) <= windowMinutes;
}

function loadJson(p) { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : []; }
function saveJson(p, data) { fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8'); }

async function processPost(post) {
    console.log(`\n🎨 Processing Post ID: ${post.originalId} (Score: ${post.score})`);
    const payloadPath = path.join(COPY_INPUT_DIR, `post_${post.originalId}.json`);
    
    // Save the payload to file so Designer can read it
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
        return true;
    } else if (approvalStatus.action === 'modify') {
        // Simple rejection for now if modified without logic, but pipeline could recurse
        console.log(`✍️ Admin requested modifications: "${approvalStatus.feedback}". (Needs Editor regeneration)`);
        return false;
    } else {
        console.log(`🗑️ Post REJECTED by Admin. Discarding.`);
        return false; // rejected
    }
}

async function runRoutineCarousel() {
    console.log("🌞 Triggering Daily Routine Carousel Scout...");
    try {
        execSync(`node ${path.join(__dirname, 'Agent_Scripts/Scout_Engine/routine_scout.js')}`, { stdio: 'inherit' });
        const routinePath = path.join(COPY_INPUT_DIR, 'post_routine_daily.json');
        if (fs.existsSync(routinePath)) {
            const routinePayload = JSON.parse(fs.readFileSync(routinePath, 'utf8'));
            const postObj = { originalId: 'routine_daily', score: 10, isUrgent: false, payload: routinePayload };
            await processPost(postObj);
        }
    } catch(e) {
        console.error("Routine generation failed:", e);
    }
}

async function runCycle() {
    console.log("\n=======================================================");
    console.log(`🚀 [Master Orchestrator] Starting New Cycle - ${new Date().toLocaleString()} (Damascus: ${getDamascusTime()})`);
    console.log("=======================================================\n");

    try {
        const scheduleConfig = JSON.parse(fs.readFileSync(SCHEDULE_CONFIG_PATH, 'utf8'));
        let memory = loadJson(MEMORY_PATH);
        const history = loadJson(HISTORY_PATH);

        // 1. Cleanup Memory (> 24 hours old)
        const ONE_DAY = 24 * 60 * 60 * 1000;
        memory = memory.filter(m => (Date.now() - m.fetchedAt) < ONE_DAY);

        // 2. Run Scout
        console.log("📡 Triggering Scout Engine...");
        execSync(`node ${path.join(__dirname, 'Agent_Scripts/Scout_Engine/scout.js')}`, { stdio: 'inherit' });
        
        let newFeed = loadJson(FEED_PATH);
        // Filter out items already in memory or history
        newFeed = newFeed.filter(item => 
            !memory.find(m => m.originalId === item.id) && 
            !history.includes(item.id)
        );

        if (newFeed.length > 0) {
            saveJson(TEMP_FEED_PATH, newFeed);
            console.log(`\n✍️ Triggering Editor Engine for ${newFeed.length} completely new articles...`);
            const curatedPayloads = await runCurator(TEMP_FEED_PATH, COPY_INPUT_DIR);
            
            // Add new curated to memory
            for (const c of curatedPayloads) {
                c.fetchedAt = Date.now();
                memory.push(c);
            }
        } else {
            console.log("😴 No completely new articles found by Scout.");
        }

        // Sort memory by score descending
        memory.sort((a, b) => b.score - a.score);
        saveJson(MEMORY_PATH, memory);

        const currentTime = getDamascusTime();
        console.log(`Current Memory State: ${memory.length} curated posts available.`);

        // 3. Process URGENT posts immediately
        const urgentPosts = memory.filter(m => m.isUrgent);
        for (const upost of urgentPosts) {
            console.log(`🚨 Processing URGENT Post: ${upost.originalId}`);
            const published = await processPost(upost);
            if (published || published === false) { // remove from memory whether approved or rejected
                memory = memory.filter(m => m.originalId !== upost.originalId);
                history.push(upost.originalId);
            }
        }

        // 4. Check Routine Carousel time
        if (scheduleConfig.routine_posts && scheduleConfig.routine_posts.enabled) {
            if (isTimeWithinWindow(currentTime, scheduleConfig.routine_posts.time, 15)) {
                // To avoid multiple triggers, check if we did it today
                const routineId = `routine_${new Date().toISOString().split('T')[0]}`;
                if (!history.includes(routineId)) {
                    await runRoutineCarousel();
                    history.push(routineId);
                }
            }
        }

        // 5. Check regular Posting Slots
        let slotMatched = false;
        for (const slot of scheduleConfig.posting_slots) {
            if (isTimeWithinWindow(currentTime, slot.time, 15)) {
                slotMatched = slot;
                break;
            }
        }

        if (slotMatched) {
            const slotHistoryId = `slot_${new Date().toISOString().split('T')[0]}_${slotMatched.time}`;
            if (!history.includes(slotHistoryId)) {
                console.log(`⏰ Slot matched: ${slotMatched.label} (${slotMatched.time}). Time for a post!`);
                const bestPost = memory.find(m => !m.isUrgent);
                if (bestPost) {
                    const published = await processPost(bestPost);
                    memory = memory.filter(m => m.originalId !== bestPost.originalId);
                    history.push(bestPost.originalId); // Record the article
                    if (published) history.push(slotHistoryId); // Mark the slot as fulfilled
                } else {
                    console.log("⚠️ No valid posts in memory for this slot.");
                }
            } else {
                console.log(`⏰ We already posted for the ${slotMatched.label} slot today.`);
            }
        }

        // Save updated state
        saveJson(MEMORY_PATH, memory);
        saveJson(HISTORY_PATH, history);

    } catch (error) {
        console.error("❌ Master Loop Error:", error);
    }

    console.log("\n=======================================================");
    console.log(`⏸️ [Master Orchestrator] Cycle Finished. Sleeping...`);
    console.log("=======================================================\n");
}

const args = process.argv.slice(2);

startBot(); // start telegram bot listening

if (args.includes('--run-now')) {
    runCycle().then(() => {
        stopBot();
        process.exit(0);
    });
} else {
    console.log("🟢 Master Orchestrator Online in Continuous Mode (every 30 mins).");
    runCycle();
    const INTERVAL_MS = 30 * 60 * 1000; 
    setInterval(runCycle, INTERVAL_MS);
}
