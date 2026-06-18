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

I will send you generated posts here for approval before they go live on social media.`);
});

// Handle text messages (used for providing feedback when modifying)
bot.on('text', (ctx) => {
    const text = ctx.message.text;
    
    // Check if the admin is currently providing feedback for a specific post
    for (const [postId, state] of pendingApprovals.entries()) {
        if (state.status === 'awaiting_feedback') {
            // Resolve the pending promise with the modification feedback
            state.resolve({ action: 'modify', feedback: text });
            pendingApprovals.delete(postId);
            ctx.reply(`✍️ Modification instructions received! Sending back to the Editor Agent to regenerate the post...`);
            return;
        }
    }
});

// Handle button clicks
bot.action(/approve_(.+)/, async (ctx) => {
    const postId = ctx.match[1];
    const state = pendingApprovals.get(postId);
    
    if (state) {
        state.resolve({ action: 'approve' });
        pendingApprovals.delete(postId);
        try { await ctx.answerCbQuery('✅ Post Approved!'); } catch(e) {}
        ctx.editMessageReplyMarkup({ inline_keyboard: [] }); // Remove buttons
        ctx.reply(`✅ Post Approved! Handing over to the Publisher Engine to go live...`);
    } else {
        try { await ctx.answerCbQuery('This post is no longer pending.'); } catch(e) {}
    }
});

bot.action(/reject_(.+)/, async (ctx) => {
    const postId = ctx.match[1];
    const state = pendingApprovals.get(postId);
    
    if (state) {
        state.resolve({ action: 'reject' });
        pendingApprovals.delete(postId);
        try { await ctx.answerCbQuery('❌ Post Rejected!'); } catch(e) {}
        ctx.editMessageReplyMarkup({ inline_keyboard: [] });
        ctx.reply(`❌ Post Rejected! It has been discarded.`);
    } else {
        try { await ctx.answerCbQuery('This post is no longer pending.'); } catch(e) {}
    }
});

bot.action(/modify_(.+)/, async (ctx) => {
    const postId = ctx.match[1];
    const state = pendingApprovals.get(postId);
    
    if (state) {
        state.status = 'awaiting_feedback';
        try { await ctx.answerCbQuery(); } catch(e) {}
        ctx.editMessageReplyMarkup({ inline_keyboard: [] });
        ctx.reply(`✍️ Please reply to this message with your instructions on what to change (e.g. "Change the image to show a bank", or "Make the headline shorter"):`);
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
        bot.launch().then(() => console.log('✅ Telegram Bot listener started'));
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
        
        const messageText = `🌐 <b>Target:</b> ${platform}

📝 <b>Main Caption (FB/IG/TikTok/TG):</b>
${captionLong}

📝 <b>X (Twitter) Short Caption:</b>
${captionShort}`;
        
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('✅ Approve & Post', `approve_${postId}`)],
            [Markup.button.callback('✍️ Modify Post', `modify_${postId}`)],
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
        
        const messageText = `🚨 <b>PIPELINE ERROR</b> 🚨

📌 <b>Post ID:</b> ${postId}

⚠️ <b>Error:</b>
${errorMessage}

💡 <b>Suggested Fix:</b>
${suggestedSolution}`;
        
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

module.exports = { sendForApproval, publishToChannel, sendErrorAlert, startBot, stopBot };
