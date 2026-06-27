const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const REJECTIONS_PATH = path.join(__dirname, '../../rejections.json');
const BLUEPRINT_PATH = path.join(__dirname, '../../Blueprint/02_editor_copywriter_agent.md');
const EDITOR_CONFIG_PATH = path.join(__dirname, '../../Config/editor_config.json');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function sendAdminNotification(text) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const adminId = process.env.TELEGRAM_ADMIN_ID;
    if (botToken && adminId) {
        try {
            const axios = require('axios');
            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                chat_id: adminId,
                text: text,
                parse_mode: 'HTML'
            });
        } catch (e) {
            console.error('Failed to send Telegram notification:', e.message);
        }
    }
}

async function runNightlyEvaluation() {
    console.log("🌙 [Nightly Evaluator] Waking up to analyze system performance...");

    let rejections = [];
    if (fs.existsSync(REJECTIONS_PATH)) {
        rejections = JSON.parse(fs.readFileSync(REJECTIONS_PATH, 'utf8'));
    }

    let postLog = { count: 0 };
    const logPath = path.join(__dirname, '../../post_log.json');
    if (fs.existsSync(logPath)) {
        postLog = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    }

    console.log(`📊 Found ${rejections.length} rejections today. Total posts today: ${postLog.count}. Analyzing...`);

    let editorConfig = { heavy_model: "gemini-2.5-pro" };
    if (fs.existsSync(EDITOR_CONFIG_PATH)) {
        editorConfig = JSON.parse(fs.readFileSync(EDITOR_CONFIG_PATH, 'utf8'));
    }

    const currentBlueprint = fs.readFileSync(BLUEPRINT_PATH, 'utf8');

    const prompt = `You are the HashSYR24 Director Agent (Antigravity Nightly Evaluator).
Your job is to evaluate our entire system performance for today, read the current Editor Blueprint, and analyze any REJECTIONS (mistakes made by the AI today that the human admin rejected).
You must REWRITE the Blueprint to include new, permanent rules based on the rejections OR based on new social media algorithm tricks (like maximizing Reels, dwell time, and hashtag SEO).
You must also write a comprehensive Morning Report for the Admin, summarizing what you improved and providing a strategic tip for tomorrow.

=== TODAY'S DATA ===
Total Posts Published: ${postLog.count}
Rejections: ${JSON.stringify(rejections, null, 2)}

=== CURRENT BLUEPRINT ===
${currentBlueprint}

=== INSTRUCTIONS ===
1. Generate the completely updated Blueprint markdown. Do NOT delete existing rules. Append new strong rules based on rejections and growth strategies.
2. Generate a Telegram Summary message (using HTML formatting like <b>bold</b> and <i>italic</i>). It should summarize the changes made to the blueprint, review today's performance, and give a strategic tip for tomorrow's content to maximize exposure.
3. Output the result STRICTLY as a valid JSON object with EXACTLY two keys: "newBlueprint" (string containing the raw markdown) and "telegramSummary" (string containing the HTML message). Do NOT wrap the JSON in markdown blocks like \`\`\`json.`;

    try {
        const model = genAI.getGenerativeModel({ model: editorConfig.heavy_model });
        console.log("🧠 Thinking... Evaluating system and generating report...");
        
        const response = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        });
        
        let resultText = response.response.text().trim();
        const parsed = JSON.parse(resultText);

        if (parsed.newBlueprint) {
            fs.writeFileSync(BLUEPRINT_PATH, parsed.newBlueprint, 'utf8');
            console.log("✅ Blueprint successfully updated with new intelligence.");
        }

        if (parsed.telegramSummary) {
            console.log("📲 Sending Morning Report to Telegram...");
            await sendAdminNotification(`🌅 <b>Nightly Evaluator Report</b>\n\n${parsed.telegramSummary}`);
        }

        // Clear rejections array
        fs.writeFileSync(REJECTIONS_PATH, JSON.stringify([]), 'utf8');
        console.log("🧹 Cleared rejections.json for tomorrow.");

    } catch (err) {
        console.error("❌ Nightly Evaluator failed:", err);
    }
}

if (require.main === module) {
    runNightlyEvaluation().then(() => {
        console.log("💤 Nightly Evaluator going back to sleep.");
        process.exit(0);
    });
}

module.exports = { runNightlyEvaluation };
