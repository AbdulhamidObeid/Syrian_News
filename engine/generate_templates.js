const fs = require('fs');
const path = require('path');

const templatesDir = path.join(__dirname, 'templates');
if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true });
}

// Strictly enforced Safe Zones from local-social-designer.md
const safeZones = {
    '1080x1350': { sx: 85, sy: 215, sw: 910, sh: 967 },
    '1080x1920': { sx: 85, sy: 219, sw: 910, sh: 1516 }
};

const variations = [
    { name: '1080x1350_white',  w: 1080, h: 1350, theme: 'light', type: '1080x1350' },
    { name: '1080x1350_green',  w: 1080, h: 1350, theme: 'dark', type: '1080x1350' },
    { name: '1080x1350_black',  w: 1080, h: 1350, theme: 'dark', type: '1080x1350' },
    { name: '1080x1350_urgent', w: 1080, h: 1350, theme: 'dark', type: '1080x1350' },
    { name: '1080x1920_white',  w: 1080, h: 1920, theme: 'light', type: '1080x1920' },
    { name: '1080x1920_green',  w: 1080, h: 1920, theme: 'dark', type: '1080x1920' },
    { name: '1080x1920_black',  w: 1080, h: 1920, theme: 'dark', type: '1080x1920' },
    { name: '1080x1920_urgent', w: 1080, h: 1920, theme: 'dark', type: '1080x1920' }
];

function generateTemplate(v) {
    const isDarkTheme = v.theme === 'dark';
    const isVertical = v.h === 1920;
    
    // Strict pixel mapping from safe zones
    const zone = safeZones[v.type];
    const sx = zone.sx;
    const sy = zone.sy;
    const sw = zone.sw;
    const sh = zone.sh;

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

    // Layout Math: Dynamic Flexbox percentages
    const gap = v.type === '1080x1920' ? 48 : 32;
    const imageMin = v.type === '1080x1920' ? '43%' : '40%';
    const imageMax = v.type === '1080x1920' ? '75%' : '60%';

    // Dynamic Bullet Template based on Theme
    let bulletTemplate = '';
    // We remove fit-text-container from bullets so they all share the exact same uniform font size!
    // Using text-[26px] (approx text-3xl) for a 1080px canvas gives a great readable size.
    const bulletTextClass = `w-full ${textColorPrimary} text-right leading-[1.6] text-[26px]`;

    if (v.name.includes('black')) {
        // Numbers only, right-aligned
        bulletTemplate = `
        <div class="w-full flex-1 ${bentoBgClass} rounded-3xl px-6 py-4 flex items-center border ${isDarkTheme ? 'border-white/10' : 'border-black/5'}">
            <div class="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full ${bentoNumBg} font-mono font-bold text-2xl ml-6">
                __BULLET_INDEX__
            </div>
            <div class="flex-1 flex items-center justify-start">
                <div class="${bulletTextClass}" dir="rtl">__BULLET_TEXT__</div>
            </div>
        </div>
        `;
    } else if (v.name.includes('green')) {
        // Text only, perfectly centered
        bulletTemplate = `
        <div class="w-full flex-1 ${bentoBgClass} rounded-3xl px-8 py-4 flex items-center justify-center border ${isDarkTheme ? 'border-white/10' : 'border-black/5'}">
            <div class="flex-1 flex items-center justify-center">
                <div class="w-full ${textColorPrimary} text-center leading-[1.6] text-[26px]" dir="rtl">__BULLET_TEXT__</div>
            </div>
        </div>
        `;
    } else {
        // White & Urgent: Colored dots, right-aligned
        bulletTemplate = `
        <div class="w-full flex-1 ${bentoBgClass} rounded-3xl px-6 py-4 flex items-center border ${isDarkTheme ? 'border-white/10' : 'border-black/5'}">
            <div class="w-10 h-10 flex-shrink-0 flex items-center justify-center ml-6">
                <div class="w-4 h-4 rounded-full" style="background-color: ${accentColor}"></div>
            </div>
            <div class="flex-1 flex items-center justify-start">
                <div class="${bulletTextClass}" dir="rtl">__BULLET_TEXT__</div>
            </div>
        </div>
        `;
    }

    let urgentBadge = '';
    if (v.name.includes('urgent')) {
        urgentBadge = `
            <div class="w-full flex justify-center mb-8">
                <div class="bg-[#f43f5e] text-white px-12 py-3 rounded-full font-bold text-4xl uppercase tracking-widest">
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
    <meta id="bullet-template" content="${Buffer.from(bulletTemplate).toString('base64')}">
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
            background-image: url('file:///Users/obeid/Desktop/Antigravity-Hub/Projects/Syrian_News/Creatives/Designs/BGs/${v.name}.jpg');
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
        <!-- Bounded by max-height 35% and overflow-hidden to prevent safe zone bleeding -->
        <div class="w-full flex-none flex flex-col justify-end items-center overflow-hidden" style="max-height: 35%;">
            ${urgentBadge}
            ${!v.name.includes('urgent') ? `
            <div class="flex items-center gap-6 mb-4">
                <div class="h-[3px] w-12" style="background-color: ${accentColor}"></div>
                <span class="font-medium tracking-widest text-4xl uppercase whitespace-nowrap" style="color: ${accentColor};">__SUB_HEADLINE__</span>
                <div class="h-[3px] w-12" style="background-color: ${accentColor}"></div>
            </div>
            ` : ''}
            <div class="w-full">
                <!-- We remove textFit and use __HEADLINE_CLASSES__ to pass dynamic font sizing -->
                <h1 class="${textColorPrimary} text-center leading-[1.3] __HEADLINE_CLASSES__ line-clamp-2">
                    __MAIN_HEADLINE__
                </h1>
            </div>
        </div>

        <!-- ZONE 2: Visual Anchor (Dynamic Flex) -->
        <div class="w-full relative overflow-hidden rounded-[1.5rem] border ${isDarkTheme ? 'border-white/20' : 'border-black/10'} flex-1" style="min-height: ${imageMin}; max-height: ${imageMax};">
            <img src="__MAIN_IMAGE_URL__" class="absolute inset-0 w-full h-full object-cover" />
            <div class="absolute inset-0 ring-1 ring-inset ${isDarkTheme ? 'ring-white/20' : 'ring-black/10'} rounded-[1.5rem]"></div>
        </div>

        <!-- ZONE 3: Symmetric Stacking Bullets container -->
        <div class="w-[90%] mx-auto flex-none flex flex-col gap-5 justify-end overflow-hidden" id="bento-container" style="max-height: 35%;">
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
