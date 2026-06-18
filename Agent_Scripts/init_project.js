const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

async function runInit() {
    console.log("=======================================================");
    console.log("🚀 Agent Setup & Initiation Wizard");
    console.log("=======================================================\n");

    const brandName = await askQuestion("1. Brand Name (e.g. HashSYR24): ");
    const brandNameArabic = await askQuestion("2. Brand Name Arabic (e.g. هاشتاق سوريا): ");
    const niche = await askQuestion("3. Niche (e.g. Syrian News & Daily Utility): ");
    const tgBotToken = await askQuestion("4. Telegram Bot Token: ");
    const tgAdminId = await askQuestion("5. Telegram Admin ID (numeric): ");

    console.log("\n⏳ Updating Configuration Files...");

    // 1. Update .env
    const envPath = path.join(__dirname, '../.env');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    
    // Quick regex replace for tg bot token and admin
    if (envContent.includes('TELEGRAM_BOT_TOKEN')) {
        envContent = envContent.replace(/TELEGRAM_BOT_TOKEN=.*/, `TELEGRAM_BOT_TOKEN=${tgBotToken}`);
    } else {
        envContent += `\nTELEGRAM_BOT_TOKEN=${tgBotToken}`;
    }

    if (envContent.includes('TELEGRAM_ADMIN_ID')) {
        envContent = envContent.replace(/TELEGRAM_ADMIN_ID=.*/, `TELEGRAM_ADMIN_ID=${tgAdminId}`);
    } else {
        envContent += `\nTELEGRAM_ADMIN_ID=${tgAdminId}`;
    }

    fs.writeFileSync(envPath, envContent.trim());
    console.log("✅ .env updated.");

    // 2. Update Brand Config
    const brandConfigPath = path.join(__dirname, '../Config/brand_config.json');
    if (fs.existsSync(brandConfigPath)) {
        const brandConfig = JSON.parse(fs.readFileSync(brandConfigPath, 'utf8'));
        if (brandName) brandConfig.brand.name = brandName;
        if (brandNameArabic) brandConfig.brand.name_arabic = brandNameArabic;
        if (niche) brandConfig.brand.niche = niche;
        fs.writeFileSync(brandConfigPath, JSON.stringify(brandConfig, null, 2));
        console.log("✅ brand_config.json updated.");
    }

    console.log("\n🎉 Setup Complete! You can now run the pipeline: node run_pipeline.js");
    rl.close();
}

if (require.main === module) {
    runInit().catch(console.error);
}
