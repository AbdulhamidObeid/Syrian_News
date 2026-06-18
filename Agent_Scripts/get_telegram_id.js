const { Telegraf } = require('telegraf');

const token = '8804350737:AAGRpFLfUCqNNXVacCwOyzsPgzpl6rHALRE';
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
