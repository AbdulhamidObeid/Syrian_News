/**
 * get_telegram_id.js
 * 
 * One-time utility to discover your Telegram User ID.
 * Run this once, send the bot a message, and it will print your ID.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Telegraf } = require('telegraf');

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
    console.error("❌ TELEGRAM_BOT_TOKEN not found in .env file.");
    process.exit(1);
}

const bot = new Telegraf(token);

console.log("Listening for messages... Please send any message (like 'Hello') in your Telegram Bot!");

bot.on('message', (ctx) => {
    const chatId = ctx.chat.id;
    console.log(`\n✅ USER ID FOUND!`);
    console.log(`Your Telegram User ID is: ${chatId}`);
    console.log(`The bot is now secure. Please stop this script.`);
    
    ctx.reply(`Hello! I have captured your User ID: ${chatId}. The bot is now securely locked to you.`);
    process.exit(0);
});

bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
