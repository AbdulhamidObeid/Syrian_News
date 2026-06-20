require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

const token = process.env.TELEGRAM_BOT_TOKEN;
const adminId = parseInt(process.env.TELEGRAM_ADMIN_ID, 10);
const channelId = process.env.TELEGRAM_CHANNEL_ID;

if (!token || !adminId) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_ID in .env file");
}

const bot = new Telegraf(token);

// State management for pending approvals
const pendingApprovals = new Map();

// Image model toggle — persists across the session
// Supported slugs: 'nano-banana-pro' | 'flux-2-pro'
let currentImageModel = 'nano-banana-pro';
const IMAGE_MODELS = {
    'nano-banana-pro': { label: 'Nano Banana Pro', next: 'flux-2-pro' },
    'flux-2-pro':      { label: 'FLUX.2 Pro',      next: 'nano-banana-pro' },
};

function getActiveModel() { return currentImageModel; }
function toggleImageModel() {
    currentImageModel = IMAGE_MODELS[currentImageModel].next;
    return currentImageModel;
}

bot.use(async (ctx, next) => {
    // Security check: Only allow the admin
    if (ctx.from && ctx.from.id !== adminId) {
        console.log(`Blocked unauthorized user: ${ctx.from.id}`);
        return;
    }
    return next();
});

// Start command
bot.command('start', (ctx) => {
    ctx.reply(`✅ HashSYR24 Control Center is Online!

Commands:
/postnow — 🚀 Override publish: pick best story from library & send for approval immediately (bypasses quota & timing rules)

I will also send you generated posts here for approval before they go live on social media.`);
});

// ---- Override Publish (/postnow) ----
// Registered dynamically from run_pipeline.js via registerBoostCommand()
let _boostHandler = null;
function registerBoostCommand(handler) {
    _boostHandler = handler;
    // Register the /postnow command so it appears in Telegram’s "/" shortcut menu
    bot.telegram.setMyCommands([
        { command: 'postnow', description: '🚀 Override publish — pick best story & send for approval now' },
    ]).catch(() => {});
}

bot.command('postnow', async (ctx) => {
    if (!_boostHandler) {
        return ctx.reply('⚠️ Override publish not initialised yet. Try again in a moment.');
    }
    await ctx.reply(`🚀 <b>Override Publish triggered!</b>

Picking the best story from the library and sending it through the pipeline. This bypasses all quota and timing rules. I'll send you the post for approval shortly.`, { parse_mode: 'HTML' });
    try {
        await _boostHandler(ctx);
    } catch (err) {
        console.error('❌ Boost handler error:', err);
        ctx.reply(`❌ Override publish failed: ${err.message}`);
    }
});

// Handle text messages (used for providing feedback when modifying)
bot.on('text', async (ctx) => {
    const text = ctx.message.text;

    // ---- Persistent keyboard button: "🚀 Post Now" ----
    if (text === '🚀 Post Now') {
        if (!_boostHandler) {
            return ctx.reply('⚠️ Override publish not ready yet. Try again in a moment.');
        }
        await ctx.reply('🚀 Picking the best story from the library and running it through the pipeline. I\'ll send you the post for approval shortly...');
        try {
            await _boostHandler(ctx);
        } catch (err) {
            console.error('❌ Boost handler error:', err);
            ctx.reply(`❌ Override publish failed: ${err.message}`);
        }
        return;
    }

    // Check if the admin is currently providing text feedback for a specific post
    for (const [postId, state] of pendingApprovals.entries()) {
        if (state.status === 'awaiting_feedback_writer') {
            state.resolve({ action: 'modify_writer', feedback: text });
            pendingApprovals.delete(postId);
            ctx.reply(`✍️ Writer feedback received! Refining content and regenerating...`);
            return;
        } else if (state.status === 'awaiting_feedback_designer') {
            state.resolve({ action: 'modify_designer', feedback: text });
            pendingApprovals.delete(postId);
            ctx.reply(`🎨 Designer feedback received! Refining image prompt and regenerating...`);
            return;
        }
    }
});

// Handle button clicks
bot.action(/approve_(.+)/, async (ctx) => {
    const postId = ctx.match[1];
    const state = pendingApprovals.get(postId);
    console.log(`\n👉 Received 'approve' callback for postId: ${postId}`);
    console.log(`👉 Current pendingApprovals keys:`, Array.from(pendingApprovals.keys()));
    console.log(`👉 Found state:`, !!state);
    
    if (state) {
        try { await ctx.answerCbQuery('✅ Post Approved!'); } catch(e) {}
        try { await ctx.editMessageReplyMarkup({ inline_keyboard: [] }); } catch(e) {}
        try { await ctx.reply(`✅ Post Approved! Handing over to the Publisher Engine to go live...`); } catch(e) {}
        
        state.resolve({ action: 'approve' });
        pendingApprovals.delete(postId);
    } else {
        try { await ctx.answerCbQuery('This post is no longer pending.'); } catch(e) {}
    }
});

bot.action(/reject_(.+)/, async (ctx) => {
    const postId = ctx.match[1];
    const state = pendingApprovals.get(postId);
    
    if (state) {
        try { await ctx.answerCbQuery('❌ Post Rejected!'); } catch(e) {}
        try { await ctx.editMessageReplyMarkup({ inline_keyboard: [] }); } catch(e) {}
        try { await ctx.reply(`❌ Post Rejected! It has been discarded.`); } catch(e) {}
        
        state.resolve({ action: 'reject' });
        pendingApprovals.delete(postId);
    } else {
        try { await ctx.answerCbQuery('This post is no longer pending.'); } catch(e) {}
    }
});

// Step 1 — "Modify" button: show agent selection sub-menu
bot.action(/modify_(.+)/, async (ctx) => {
    const postId = ctx.match[1];
    const state = pendingApprovals.get(postId);
    
    // Skip if this is actually a more specific action (rerun_from_* or modify_writer_* etc.)
    // Telegraf matches in registration order, so this handler catches only the plain modify_<postId>
    if (!state) {
        try { await ctx.answerCbQuery('This post is no longer pending.'); } catch(e) {}
        return;
    }

    try { await ctx.answerCbQuery('Choose which agent to rerun from 👇'); } catch(e) {}

    // Show agent selection keyboard
    const nextModel = IMAGE_MODELS[currentImageModel].next;
    const nextModelLabel = IMAGE_MODELS[nextModel].label;
    const activeModelLabel = IMAGE_MODELS[currentImageModel].label;
    const agentKeyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback('✍️ Writer  (rewrite content)', `rerun_writer_${postId}`),
        ],
        [
            Markup.button.callback('🎨 Designer  (new image)', `rerun_designer_${postId}`),
        ],
        [
            Markup.button.callback(`🔄 Switch Generator → ${nextModelLabel}`, `switch_model_${postId}`),
        ],
        [
            Markup.button.callback('✍️ Writer + 📝 Custom instructions', `feedback_writer_${postId}`),
        ],
        [
            Markup.button.callback('🎨 Designer + 📝 Custom instructions', `feedback_designer_${postId}`),
        ],
        [
            Markup.button.callback('⬅️ Back', `back_to_approval_${postId}`),
        ],
    ]);

    try {
        await ctx.editMessageReplyMarkup(agentKeyboard.reply_markup);
        await ctx.answerCbQuery(`🔧 Choose agent to rerun. Active: ${activeModelLabel}`);
    } catch(e) {
        console.error('Error updating keyboard:', e.message);
    }
});

// Switch Image Generator — toggles model and immediately reruns Designer
bot.action(/switch_model_(.+)/, async (ctx) => {
    const postId = ctx.match[1];
    const state = pendingApprovals.get(postId);
    if (state) {
        const newModel = toggleImageModel();
        const newModelLabel = IMAGE_MODELS[newModel].label;
        state.resolve({ action: 'rerun_from', agent: 'designer', imageModel: newModel });
        pendingApprovals.delete(postId);
        try { await ctx.editMessageReplyMarkup({ inline_keyboard: [] }); } catch(e) {}
        try { await ctx.answerCbQuery(`🔄 Switched to ${newModelLabel}!`); } catch(e) {}
        ctx.reply(`🔄 Switched image generator to <b>${newModelLabel}</b>. Regenerating image now... The post will be sent for approval shortly.`, { parse_mode: 'HTML' });
    } else {
        try { await ctx.answerCbQuery('This post is no longer pending.'); } catch(e) {}
    }
});

// Step 2a — Rerun from Writer (no custom feedback — just rerun)
bot.action(/rerun_writer_(.+)/, async (ctx) => {
    const postId = ctx.match[1];
    const state = pendingApprovals.get(postId);
    if (state) {
        state.resolve({ action: 'rerun_from', agent: 'writer' });
        pendingApprovals.delete(postId);
        try { await ctx.editMessageReplyMarkup({ inline_keyboard: [] }); } catch(e) {}
        try { await ctx.answerCbQuery('✍️ Rerunning Writer Agent...'); } catch(e) {}
        ctx.reply(`✍️ Rerunning the <b>Writer Agent</b> from scratch. Designer and everything after will follow. Sending updated post for approval shortly...`, { parse_mode: 'HTML' });
    } else {
        try { await ctx.answerCbQuery('This post is no longer pending.'); } catch(e) {}
    }
});

// Step 2b — Rerun from Designer (no custom feedback — just regenerate image)
bot.action(/rerun_designer_(.+)/, async (ctx) => {
    const postId = ctx.match[1];
    const state = pendingApprovals.get(postId);
    if (state) {
        state.resolve({ action: 'rerun_from', agent: 'designer' });
        pendingApprovals.delete(postId);
        try { await ctx.editMessageReplyMarkup({ inline_keyboard: [] }); } catch(e) {}
        try { await ctx.answerCbQuery('🎨 Rerunning Designer Agent...'); } catch(e) {}
        ctx.reply(`🎨 Rerunning the <b>Designer Agent</b> — regenerating the image with the existing prompt. Sending updated post for approval shortly...`, { parse_mode: 'HTML' });
    } else {
        try { await ctx.answerCbQuery('This post is no longer pending.'); } catch(e) {}
    }
});

// Step 2c — Writer with custom text feedback
bot.action(/feedback_writer_(.+)/, async (ctx) => {
    const postId = ctx.match[1];
    const state = pendingApprovals.get(postId);
    if (state) {
        state.status = 'awaiting_feedback_writer';
        try { await ctx.editMessageReplyMarkup({ inline_keyboard: [] }); } catch(e) {}
        try { await ctx.answerCbQuery(); } catch(e) {}
        ctx.reply(`✍️ Type your instructions for the Writer Agent (e.g. "Shorten the headline", "Make tone more urgent"):`); 
    } else {
        try { await ctx.answerCbQuery('This post is no longer pending.'); } catch(e) {}
    }
});

// Step 2d — Designer with custom text feedback
bot.action(/feedback_designer_(.+)/, async (ctx) => {
    const postId = ctx.match[1];
    const state = pendingApprovals.get(postId);
    if (state) {
        state.status = 'awaiting_feedback_designer';
        try { await ctx.editMessageReplyMarkup({ inline_keyboard: [] }); } catch(e) {}
        try { await ctx.answerCbQuery(); } catch(e) {}
        ctx.reply(`🎨 Type your instructions for the Designer Agent (e.g. "Change image to show Damascus", "Make it darker"):`); 
    } else {
        try { await ctx.answerCbQuery('This post is no longer pending.'); } catch(e) {}
    }
});

// Step 2e — Back to original approval buttons
bot.action(/back_to_approval_(.+)/, async (ctx) => {
    const postId = ctx.match[1];
    const state = pendingApprovals.get(postId);
    if (state) {
        try { await ctx.answerCbQuery('Going back...'); } catch(e) {}
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('✅ Approve & Post', `approve_${postId}`)],
            [Markup.button.callback('✏️ Modify', `modify_${postId}`)],
            [Markup.button.callback('❌ Reject (Trash)', `reject_${postId}`)]
        ]);
        try {
            await ctx.editMessageReplyMarkup(keyboard.reply_markup);
        } catch(e) {
            console.error('Error reverting keyboard:', e.message);
        }
    } else {
        try { await ctx.answerCbQuery('This post is no longer pending.'); } catch(e) {}
    }
});

bot.action(/retry_(.+)/, async (ctx) => {
    const postId = ctx.match[1];
    const state = pendingApprovals.get(postId);
    
    if (state) {
        state.resolve({ action: 'retry' });
        pendingApprovals.delete(postId);
        try { await ctx.answerCbQuery(); } catch(e) {}
        ctx.editMessageReplyMarkup({ inline_keyboard: [] });
        ctx.reply(`🔄 Retrying Post...`);
    } else {
        try { await ctx.answerCbQuery('This error is no longer pending.'); } catch(e) {}
    }
});

bot.action(/skip_error_(.+)/, async (ctx) => {
    const postId = ctx.match[1];
    const state = pendingApprovals.get(postId);
    
    if (state) {
        state.resolve({ action: 'skip' });
        pendingApprovals.delete(postId);
        try { await ctx.answerCbQuery(); } catch(e) {}
        ctx.editMessageReplyMarkup({ inline_keyboard: [] });
        ctx.reply(`⏭️ Skipping Post and moving on.`);
    } else {
        try { await ctx.answerCbQuery('This error is no longer pending.'); } catch(e) {}
    }
});

// Start the bot gracefully
let botStarted = false;
function startBot() {
    if (!botStarted) {
        bot.launch().then(() => {
            console.log('✅ Telegram Bot listener started');
            // Send persistent Reply Keyboard to admin so the 🚀 button always appears
            const persistentKeyboard = Markup.keyboard([
                ['🚀 Post Now']
            ]).resize().persistent();
            bot.telegram.sendMessage(
                adminId,
                '🟢 <b>HashSYR24 Engine Online</b> — tap the button below anytime to override-publish a story instantly.',
                { parse_mode: 'HTML', ...persistentKeyboard }
            ).catch(() => {});
        });
        process.once('SIGINT', () => bot.stop('SIGINT'));
        process.once('SIGTERM', () => bot.stop('SIGTERM'));
        botStarted = true;
    }
}

function stopBot() {
    if (botStarted) {
        bot.stop('graceful stop');
        botStarted = false;
    }
}

/**
 * Sends a post to the Admin via Telegram for approval.
 * @param {string|string[]} imagePath - Path to the local image file, or array of paths for Carousel
 * @param {string} captionLong - The generated Arabic long caption
 * @param {string} captionShort - The generated Arabic short caption
 * @param {string} platform - The target platform (e.g. "All Platforms", "TikTok Only")
 * @returns {Promise<{action: 'approve'|'reject'|'modify', feedback?: string}>}
 */
async function sendForApproval(imagePath, captionLong, captionShort, platform = 'All Platforms') {
    return new Promise(async (resolve, reject) => {
        const postId = Date.now().toString();
        
        // Register the pending approval
        pendingApprovals.set(postId, { status: 'pending', resolve, reject });
        
        const escapeHtml = (text) => {
            if (!text) return '';
            return text.replace(/&/g, '&amp;')
                       .replace(/</g, '&lt;')
                       .replace(/>/g, '&gt;');
        };

        const safeCaptionLong = escapeHtml(captionLong);
        const safeCaptionShort = escapeHtml(captionShort);

        const messageText = `🌐 <b>Target:</b> ${platform}

📝 <b>Main Caption (FB/IG/TikTok/TG):</b>
${safeCaptionLong}

📝 <b>X (Twitter) Short Caption:</b>
${safeCaptionShort}`;
        
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('✅ Approve & Post', `approve_${postId}`)],
            [Markup.button.callback('✏️ Modify', `modify_${postId}`)],
            [Markup.button.callback('❌ Reject (Trash)', `reject_${postId}`)]
        ]);

        try {
            if (Array.isArray(imagePath) && imagePath.length > 0) {
                // Handle Carousel (Media Group)
                const mediaGroup = imagePath.map(p => ({ type: 'photo', media: { source: p } }));
                await bot.telegram.sendMediaGroup(adminId, mediaGroup);
                // Send buttons and caption in a separate message
                await bot.telegram.sendMessage(adminId, messageText, { parse_mode: 'HTML', ...keyboard });
            } else {
                // Handle Single Image
                const singlePath = Array.isArray(imagePath) ? imagePath[0] : imagePath;
                await bot.telegram.sendPhoto(adminId, { source: singlePath }, {
                    caption: messageText,
                    parse_mode: 'HTML',
                    ...keyboard
                });
            }
            console.log(`📤 Post ${postId} sent to Telegram Admin for approval. Waiting for response...`);
        } catch (error) {
            console.error('❌ Failed to send Telegram message:', error.message);
            pendingApprovals.delete(postId);
            reject(error);
        }
    });
}

/**
 * Publishes a finalized post to the public Telegram Channel.
 * @param {string|string[]} imagePath - Path to the local image file, or array of paths
 * @param {string} caption - The generated Arabic caption
 */
async function publishToChannel(imagePath, caption) {
    if (!channelId) {
        console.log("⚠️ No TELEGRAM_CHANNEL_ID set. Skipping channel broadcast.");
        return;
    }
    try {
        if (Array.isArray(imagePath) && imagePath.length > 0) {
            const mediaGroup = imagePath.map((p, index) => {
                const item = { type: 'photo', media: { source: p } };
                if (index === 0) {
                    item.caption = caption;
                    item.parse_mode = 'HTML';
                }
                return item;
            });
            await bot.telegram.sendMediaGroup(channelId, mediaGroup);
        } else {
            const singlePath = Array.isArray(imagePath) ? imagePath[0] : imagePath;
            await bot.telegram.sendPhoto(channelId, { source: singlePath }, {
                caption: caption,
                parse_mode: 'HTML'
            });
        }
        console.log(`✅ [Telegram Engine] Successfully broadcasted to channel ${channelId}`);
    } catch (error) {
        console.error(`❌ [Telegram Engine] Failed to broadcast to channel:`, error.message);
    }
}

/**
 * Sends an error alert to the Admin via Telegram and waits for an action.
 * @param {string} errorMessage - The error message string
 * @param {string} postId - The ID of the post that failed
 * @param {string} suggestedSolution - Suggested instructions for the admin
 * @returns {Promise<{action: 'retry'|'skip'}>}
 */
async function sendErrorAlert(errorMessage, postId, suggestedSolution = "Check logs or system state.") {
    return new Promise(async (resolve, reject) => {
        // Register the pending error alert
        pendingApprovals.set(postId, { status: 'pending_error', resolve, reject });
        
        const escapeHtml = (text) => {
            if (!text) return '';
            return text.replace(/&/g, '&amp;')
                       .replace(/</g, '&lt;')
                       .replace(/>/g, '&gt;');
        };

        const safeErrorMessage = escapeHtml(errorMessage);
        const safeSuggestedSolution = escapeHtml(suggestedSolution);

        const messageText = `🚨 <b>PIPELINE ERROR</b> 🚨

📌 <b>Post ID:</b> ${postId}

⚠️ <b>Error:</b>
${safeErrorMessage}

💡 <b>Suggested Fix:</b>
${safeSuggestedSolution}`;
        
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Retry Post', `retry_${postId}`)],
            [Markup.button.callback('⏭️ Skip Post', `skip_error_${postId}`)]
        ]);

        try {
            await bot.telegram.sendMessage(adminId, messageText, { parse_mode: 'HTML', ...keyboard });
            console.log(`🚨 Error Alert sent for Post ${postId}. Waiting for admin response...`);
        } catch (error) {
            console.error('❌ Failed to send Telegram Error Alert:', error.message);
            pendingApprovals.delete(postId);
            // If we can't send the alert, just resolve as skip to prevent total lockup? 
            // Or reject to throw it up? Let's resolve as skip so the pipeline survives.
            resolve({ action: 'skip' });
        }
    });
}

module.exports = { 
    sendForApproval, 
    publishToChannel, 
    sendErrorAlert, 
    startBot, 
    stopBot, 
    getActiveModel, 
    registerBoostCommand,
    isApprovalPending: () => pendingApprovals.size > 0
};
