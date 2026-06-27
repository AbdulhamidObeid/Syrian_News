const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const REJECTIONS_PATH = path.join(__dirname, '../../rejections.json');
const BLUEPRINT_PATH = path.join(__dirname, '../../Blueprint/02_editor_copywriter_agent.md');

// Temporary bridge directory for Python interop
const TEMP_BRIDGE_DIR = path.join(__dirname, 'temp_bridge');
if (!fs.existsSync(TEMP_BRIDGE_DIR)) {
    fs.mkdirSync(TEMP_BRIDGE_DIR, { recursive: true });
}

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
    console.log("🌙 [Nightly Evaluator] Waking up to analyze system performance... [via Antigravity SDK]");

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

    const currentBlueprint = fs.readFileSync(BLUEPRINT_PATH, 'utf8');

    const payload = {
        postCount: postLog.count,
        rejections: rejections,
        currentBlueprint: currentBlueprint
    };

    const runId = Date.now() + Math.floor(Math.random() * 1000);
    const inputPath = path.join(TEMP_BRIDGE_DIR, `in_eval_${runId}.json`);
    const outputPath = path.join(TEMP_BRIDGE_DIR, `out_eval_${runId}.json`);

    fs.writeFileSync(inputPath, JSON.stringify(payload, null, 2), 'utf8');

    try {
        console.log("🧠 Thinking... Evaluating system and generating report...");
        const pythonScript = path.join(__dirname, 'nightly_evaluator.py');
        execSync(`/opt/homebrew/bin/python3.10 ${pythonScript} ${inputPath} ${outputPath}`, { stdio: 'inherit' });

        if (fs.existsSync(outputPath)) {
            const parsed = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
            
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

            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);
        } else {
            throw new Error(`Python script did not produce output file: ${outputPath}`);
        }
    } catch (err) {
        console.error("❌ Nightly Evaluator failed:", err);
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
}

if (require.main === module) {
    runNightlyEvaluation().then(() => {
        console.log("💤 Nightly Evaluator going back to sleep.");
        process.exit(0);
    });
}

module.exports = { runNightlyEvaluation };
