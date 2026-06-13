const fs = require('fs');
const path = require('path');

const templatesDir = path.join(__dirname, 'templates');
if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true });
}

const configPath = path.join(__dirname, '../../Config/designer_config.json');
const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const variations = [
    { name: '1080x1350_white',  w: 1080, h: 1350, theme: 'light', type: '1080x1350' },
    { name: '1080x1350_green',  w: 1080, h: 1350, theme: 'dark', type: '1080x1350' },
    { name: '1080x1350_black',  w: 1080, h: 1350, theme: 'dark', type: '1080x1350' },
    { name: '1080x1350_urgent', w: 1080, h: 1350, theme: 'dark', type: '1080x1350' }
];

function generateTemplate(v) {
    const isDarkTheme = v.theme === 'dark';
    
    // Strict pixel mapping from dynamic safe zone extraction
    const zone = configData[v.name];
    const sx = Math.abs(zone.left); // Ensure positive just in case
    
    // Illustrator's Y-axis is inverted relative to HTML.
    // If top is positive (origin bottom-left), distance from top is docHeight - top.
    // If top is negative (origin top-left), distance from top is Math.abs(top).
    const sy = zone.top > 0 ? (zone.docHeight - zone.top) : Math.abs(zone.top);
    
    const sw = zone.width;
    const sh = zone.height;

    // Design System Tokens (local-social-designer.md strictly)
    const textColorPrimary = isDarkTheme ? 'text-white' : 'text-slate-900';
    
    // Accent logic from Rule 5
    let accentColor = '#0d9488'; // Teal
    if (v.name.includes('black')) {
        accentColor = '#DBBE8F'; // Gold
    } else if (v.name.includes('urgent')) {
        accentColor = '#f43f5e'; // Red
    }

    // Glassmorphism brand identity - less dark
    let bentoBgClass = isDarkTheme ? 'bg-black/30 backdrop-blur-3xl border border-white/20' : 'bg-white/50 backdrop-blur-3xl border border-black/10';
    let bentoNumBg = isDarkTheme ? 'bg-white text-black' : 'bg-black text-white';

    // Layout Math: Dynamic Flexbox gaps
    const gap = 32;
    // Image strictly enforces minimum 40%. It will flex-grow to fill empty space.
    const imageMin = '40%';

    // Dynamic Bullet Templates (All injected so the engine can pick)
    const bulletTextClass = `w-full ${textColorPrimary} leading-[1.5] bullet-text`;

    const bulletTemplateDots = `
    <div class="w-full h-full min-w-0 ${bentoBgClass} rounded-3xl px-6 py-4 flex items-start border ${isDarkTheme ? 'border-white/10' : 'border-black/5'} bullet-box">
        <div class="w-3 h-3 flex-shrink-0 flex items-center justify-center rounded-full ml-5 mt-2.5 bullet-dot" style="background-color: ${accentColor}"></div>
        <div class="flex-1 flex items-center justify-start h-full min-w-0">
            <div class="${bulletTextClass} text-right" dir="rtl">__BULLET_TEXT__</div>
        </div>
    </div>
    `;

    const bulletTemplateNums = `
    <div class="w-full h-full min-w-0 ${bentoBgClass} rounded-3xl px-6 py-4 flex items-center border ${isDarkTheme ? 'border-white/10' : 'border-black/5'} bullet-box">
        <div class="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full ${bentoNumBg} font-mono font-bold text-xl ml-4 bullet-num">
            __BULLET_INDEX__
        </div>
        <div class="flex-1 flex items-center justify-start h-full min-w-0">
            <div class="${bulletTextClass} text-right" dir="rtl">__BULLET_TEXT__</div>
        </div>
    </div>
    `;

    const bulletTemplateIcons = `
    <div class="w-full h-full min-w-0 ${bentoBgClass} rounded-3xl px-6 py-8 flex flex-col items-center justify-center border ${isDarkTheme ? 'border-white/10' : 'border-black/5'} bullet-box">
        <div class="w-16 h-16 rounded-full flex items-center justify-center mb-4" style="background-color: ${accentColor}33; color: ${accentColor};">
            __BULLET_ICON__
        </div>
        <div class="flex-1 flex items-center justify-center w-full min-w-0">
            <div class="${bulletTextClass} text-center" dir="rtl">__BULLET_TEXT__</div>
        </div>
    </div>
    `;

    let urgentBadge = '';
    if (v.name.includes('urgent')) {
        urgentBadge = `
            <div class="flex items-center justify-center mb-4 h-[56px] flex-none">
                <div class="bg-[#f43f5e] text-white px-8 py-1.5 rounded-full font-bold text-3xl uppercase tracking-widest leading-none flex items-center justify-center">
                    عاجل
                </div>
            </div>
        `;
    }

    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fixed Layout: ${v.name}</title>
    <meta id="bullet-template-dots" content="${Buffer.from(bulletTemplateDots).toString('base64')}">
    <meta id="bullet-template-nums" content="${Buffer.from(bulletTemplateNums).toString('base64')}">
    <meta id="bullet-template-icons" content="${Buffer.from(bulletTemplateIcons).toString('base64')}">
    <!-- Official Font: IBM Plex Sans Arabic -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/textfit/2.4.0/textFit.min.js"></script>
    <script>
        tailwind.config = {
            theme: { extend: { fontFamily: { sans: ['IBM Plex Sans Arabic', 'sans-serif'] } } }
        }
    </script>
    <style>
        body, html {
            margin: 0; padding: 0; width: ${v.w}px; height: ${v.h}px; overflow: hidden;
            background-color: transparent;
            background-image: url('file:///Users/obeid/Desktop/Antigravity-Hub/Projects/Syrian_News/Assets/Templates/${v.name}.jpg');
            background-size: cover; background-position: center;
        }

        #content-sandbox {
            position: absolute;
            left: ${sx}px; top: ${sy}px; width: ${sw}px; height: ${sh}px;
        }
    </style>
</head>
<body class="antialiased">
    <div id="content-sandbox" dir="rtl" class="flex flex-col justify-between" style="gap: ${gap}px;">
        
        <!-- ZONE 1: Typographic Hero -->
        <!-- Takes exactly the space it needs to render text perfectly -->
        <div class="w-full flex-none flex flex-col justify-end items-center" id="headline-zone">
            ${v.name.includes('urgent') ? urgentBadge : `
            <div class="flex items-center gap-6 mb-4">
                <div class="h-[3px] w-12" style="background-color: ${accentColor}"></div>
                <span class="font-medium tracking-widest text-4xl uppercase whitespace-nowrap" style="color: ${accentColor};">__SUB_HEADLINE__</span>
                <div class="h-[3px] w-12" style="background-color: ${accentColor}"></div>
            </div>
            `}
            <div class="w-full">
                <!-- We inject the max-bound headline classes via JS -->
                <h1 class="${textColorPrimary} text-center leading-[1.3] __HEADLINE_CLASSES__ line-clamp-2" id="main-headline">
                    __MAIN_HEADLINE__
                </h1>
            </div>
        </div>

        <!-- ZONE 2: Visual Anchor (Dynamic Flex) -->
        <!-- Flex-1 allows the image to absorb ALL remaining space, guaranteeing it fills the canvas beautifully -->
        <!-- Min-height 40% strictly enforces the brand rule -->
        <div class="w-full relative overflow-hidden rounded-[1.5rem] border ${isDarkTheme ? 'border-white/20' : 'border-black/10'} flex-1" style="min-height: ${imageMin};">
            <img src="__MAIN_IMAGE_URL__" class="absolute inset-0 w-full h-full object-cover" />
            <div class="absolute inset-0 ring-1 ring-inset ${isDarkTheme ? 'ring-white/20' : 'ring-black/10'} rounded-[1.5rem]"></div>
        </div>

        <!-- ZONE 3: Smart Grid Bullets container -->
        <!-- Firewalled vertically (max-h 35%) so it NEVER pushes the image into overlapping -->
        <div class="w-[90%] mx-auto flex-none overflow-hidden" id="bento-container" style="max-height: 35%;">
            __BULLETS_HTML__
        </div>
    </div>
</body>
</html>`;
}

for (const v of variations) {
    const html = generateTemplate(v);
    const outPath = path.join(templatesDir, `${v.name}.html`);
    fs.writeFileSync(outPath, html);
    console.log(`Successfully built Remediated template: ${outPath}`);
}
