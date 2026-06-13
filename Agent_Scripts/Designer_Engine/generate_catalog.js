const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, 'catalog_output');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const DUMMY_TEXT = [
    "تخفيض نسبة الفائدة على القروض لدعم الشركات الصغيرة والمتوسطة.",
    "إطلاق منصة رقمية لتسهيل الحوالات المالية الدولية بشكل فوري وآمن.",
    "دعم قطاع الزراعة والصناعة بقروض ميسرة طويلة الأجل.",
    "تأسيس صندوق استثماري بالشراكة مع القطاع الخاص للابتكار."
];

// Used specifically for 2-side to prove it can handle more text at a slightly smaller font size
const DUMMY_TEXT_LONG = [
    "تخفيض نسبة الفائدة على القروض لدعم الشركات الصغيرة والمتوسطة وتحفيز عجلة الإنتاج المحلي وتوفير فرص عمل جديدة في كافة المحافظات.",
    "إطلاق منصة رقمية متطورة لتسهيل الحوالات المالية الدولية بشكل فوري وآمن للمواطنين والشركات لضمان استقرار السوق."
];

// Used specifically for 3-stack to prove it works perfectly for short one-liners
const DUMMY_TEXT_SHORT = [
    "تخفيض نسبة الفائدة على القروض لدعم الشركات والمشاريع.",
    "إطلاق منصة رقمية متطورة لتسهيل الحوالات المالية الدولية.",
    "تأسيس صندوق استثماري مشترك بالتعاون مع القطاع الخاص."
];

const ICONS = [
    `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
    `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>`,
    `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
    `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>`
];

const layouts = [];
const addLayout = (name, layoutType, pointCount, bulletSystem, titleLines) => {
    layouts.push({ name, layoutType, pointCount, bulletSystem, titleLines });
};

// --- BUILD 112 TARGET LAYOUTS (GREEN, WHITE, BLACK, URGENT) ---
const colors = ['green', 'white', 'black', 'urgent'];

colors.forEach(color => {
    // 1. DOTS (14 per color)
    [1, 2].forEach(titleLines => {
        const t = `T${titleLines}`;
        addLayout(`1350_${color}_1box_${t}_dots`, '1-box', 1, 'dots', titleLines);
        addLayout(`1350_${color}_2stack_${t}_dots`, '2-stack', 2, 'dots', titleLines);
        addLayout(`1350_${color}_2side_${t}_dots`, '2-side', 2, 'dots', titleLines);
        addLayout(`1350_${color}_3stack_${t}_dots`, '3-stack', 3, 'dots', titleLines);
        addLayout(`1350_${color}_3mixed-top_${t}_dots`, '3-mixed-top', 3, 'dots', titleLines);
        addLayout(`1350_${color}_3mixed-bottom_${t}_dots`, '3-mixed-bottom', 3, 'dots', titleLines);
        addLayout(`1350_${color}_4grid_${t}_dots`, '4-grid', 4, 'dots', titleLines);
    });

    // 2. NUMS (12 per color)
    [1, 2].forEach(titleLines => {
        const t = `T${titleLines}`;
        addLayout(`1350_${color}_2stack_${t}_nums`, '2-stack', 2, 'nums', titleLines);
        addLayout(`1350_${color}_2side_${t}_nums`, '2-side', 2, 'nums', titleLines);
        addLayout(`1350_${color}_3stack_${t}_nums`, '3-stack', 3, 'nums', titleLines);
        addLayout(`1350_${color}_3mixed-top_${t}_nums`, '3-mixed-top', 3, 'nums', titleLines);
        addLayout(`1350_${color}_3mixed-bottom_${t}_nums`, '3-mixed-bottom', 3, 'nums', titleLines);
        addLayout(`1350_${color}_4grid_${t}_nums`, '4-grid', 4, 'nums', titleLines);
    });

    // 3. ICONS (2 per color)
    [1, 2].forEach(titleLines => {
        const t = `T${titleLines}`;
        addLayout(`1350_${color}_2side_${t}_icons`, '2-side', 2, 'icons', titleLines);
    });
});

async function run() {
    const browser = await puppeteer.launch({ headless: 'new' });
    
    for (const L of layouts) {
        const color = L.name.split('_')[1]; // e.g. 'green', 'white', 'black'
        const templatePath = path.join(__dirname, 'templates', `1080x1350_${color}.html`);
        if (!fs.existsSync(templatePath)) {
            console.error(`Missing templates/1080x1350_${color}.html! Run generate_templates.js first.`);
            process.exit(1);
        }
        const baseHtml = fs.readFileSync(templatePath, 'utf8');
        console.log(`Building using Designer Engine: ${L.name}`);
        
        const match = baseHtml.match(new RegExp(`<meta id="bullet-template-${L.bulletSystem}" content="(.*?)">`));
        let bulletTemplateStr = '';
        if (match) bulletTemplateStr = Buffer.from(match[1], 'base64').toString('utf8');

        // Text Payload Mapping
        let payloadText = DUMMY_TEXT;
        if (L.layoutType === '2-side') payloadText = DUMMY_TEXT_LONG;
        if (L.layoutType === '3-stack') payloadText = DUMMY_TEXT_SHORT;

        // Gap adjustment
        const gapClass = (L.layoutType === '2-side' || L.layoutType === '4-grid') ? 'gap-3' : 'gap-4';

        let bulletsHtml = '';
        let containerClasses = '';

        const renderBullet = (index, text, cols = "") => {
            let html = bulletTemplateStr
                .replace(/__BULLET_INDEX__/g, (index + 1).toString().padStart(2, '0'))
                .replace(/__BULLET_TEXT__/g, text);
            if (L.bulletSystem === 'icons') {
                html = html.replace('__BULLET_ICON__', ICONS[index % ICONS.length]);
            }
            if (cols) html = html.replace('class="', `class="${cols} `);
            
            // USER RULE: For dots group, 2stack, 2side, 3mixed-top, 3mixed-bottom -> REMOVE dots, CENTER text, BOLD first 2 words
            if (L.bulletSystem === 'dots' && ['2-stack', '2-side', '3-mixed-top', '3-mixed-bottom'].includes(L.layoutType)) {
                html = html.replace(/<div class="w-3 h-3.*><\/div>/, ''); // Remove dot
                html = html.replace('text-right', 'text-center').replace('justify-start', 'justify-center').replace('items-start', 'items-center');
                
                // Bold first two words
                const words = text.split(' ');
                if (words.length >= 2) {
                    const modifiedText = `<span class="font-bold">${words.slice(0, 2).join(' ')}</span> ${words.slice(2).join(' ')}`;
                    html = html.replace(text, modifiedText);
                }
            }

            // USER FEEDBACK: Center green dots vertically for 3-stack and 4-grid layouts in the dots system
            if (L.bulletSystem === 'dots' && ['3-stack', '4-grid'].includes(L.layoutType)) {
                html = html.replace('items-start', 'items-center');
                html = html.replace('mt-2.5', '');
            }

            return html;
        };

        if (L.layoutType === '1-box') {
            containerClasses = `flex flex-col ${gapClass} w-full h-full`;
            bulletsHtml = renderBullet(0, payloadText[0]);
            bulletsHtml = bulletsHtml.replace(/<div class="w-3 h-3.*><\/div>/, ''); // Remove dot
            bulletsHtml = bulletsHtml.replace('text-right', 'text-center').replace('justify-start', 'justify-center').replace('items-start', 'items-center');
        } else if (L.layoutType === '2-stack') {
            containerClasses = `flex flex-col ${gapClass} w-full min-w-0`;
            bulletsHtml = renderBullet(0, payloadText[0]) + renderBullet(1, payloadText[1]);
        } else if (L.layoutType === '2-side') {
            containerClasses = `grid grid-cols-2 ${gapClass} w-full h-full min-w-0`;
            bulletsHtml = renderBullet(0, payloadText[0]) + renderBullet(1, payloadText[1]);
        } else if (L.layoutType === '3-stack') {
            containerClasses = `flex flex-col ${gapClass} w-full min-w-0`;
            bulletsHtml = renderBullet(0, payloadText[0]) + renderBullet(1, payloadText[1]) + renderBullet(2, payloadText[2]);
        } else if (L.layoutType === '3-mixed-top') {
            containerClasses = `grid grid-cols-2 ${gapClass} w-full h-full min-w-0`;
            bulletsHtml = renderBullet(0, payloadText[0] + " " + payloadText[1], "col-span-2") + 
                          renderBullet(1, payloadText[2]) + renderBullet(2, payloadText[3]);
        } else if (L.layoutType === '3-mixed-bottom') {
            containerClasses = `grid grid-cols-2 ${gapClass} w-full h-full min-w-0`;
            bulletsHtml = renderBullet(0, payloadText[0]) + renderBullet(1, payloadText[1]) + 
                          renderBullet(2, payloadText[2] + " " + payloadText[3], "col-span-2");
        } else if (L.layoutType === '4-grid') {
            containerClasses = `grid grid-cols-2 grid-rows-2 ${gapClass} w-full h-full min-w-0`;
            bulletsHtml = renderBullet(0, payloadText[0]) + renderBullet(1, payloadText[1]) + 
                          renderBullet(2, payloadText[2]) + renderBullet(3, payloadText[3]);
        }

        bulletsHtml = `<div id="grid-container" class="${containerClasses}">${bulletsHtml}</div>`;

        // Proper 1-Line vs 2-Line Titles
        let formattedHeadline = '';
        if (L.titleLines === 1) {
            // A truly short 3-word sentence that fits naturally on one line
            formattedHeadline = `<span class="font-bold">قرار حكومي جديد</span>`;
        } else {
            // 2-line sentence
            formattedHeadline = `<span class="font-medium">البنك المركزي يعلن عن</span><br/><span class="font-bold">حزمة قرارات مالية جديدة</span>`;
        }

        let finalHtml = baseHtml
            .replace(/__SUB_HEADLINE__/g, "اقتصاد")
            .replace(/__MAIN_IMAGE_URL__/g, "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1600&auto=format&fit=crop")
            .replace(/__BULLETS_HTML__/g, bulletsHtml)
            .replace(/__MAIN_HEADLINE__/g, formattedHeadline)
            .replace(/__HEADLINE_CLASSES__/g, 'text-[60px]');
        
        const tempPath = path.join(__dirname, 'temp_catalog.html');
        fs.writeFileSync(tempPath, finalHtml);
        
        let page;
        try {
            page = await browser.newPage();
            await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
            await page.goto(`file://${tempPath}`, { waitUntil: 'load' });
            
            // Wait for fonts with a timeout of 2 seconds to prevent hanging on network glitches
            await Promise.race([
                page.evaluateHandle('document.fonts.ready'),
                new Promise(resolve => setTimeout(resolve, 2000))
            ]);
            
            await new Promise(r => setTimeout(r, 500)); // wait for rendering
            
            // Apply logic specifically requested by user
            const validation = await page.evaluate(({ layoutType }) => {
                
                // For 4-grid, reduce image size and make boxes bigger
                if (layoutType === '4-grid') {
                    const bento = document.getElementById('bento-container');
                    if (bento) bento.style.maxHeight = '48%'; // originally 35%
                }

                const bulletTexts = Array.from(document.querySelectorAll('.bullet-text'));
                
                // Fixed font sizes based on user feedback
                let finalSize = 28;
                if (layoutType === '1-box') finalSize = 36;
                else if (layoutType === '2-stack') finalSize = 34;
                else if (layoutType === '2-side') finalSize = 24;
                else if (layoutType === '3-stack') finalSize = 28; // one size smaller to prevent text cutoff
                else if (layoutType === '3-mixed-top' || layoutType === '3-mixed-bottom') finalSize = 24;
                else if (layoutType === '4-grid') finalSize = 24; // Now fits much better in 48% height

                bulletTexts.forEach(el => el.style.fontSize = finalSize + 'px');

                // Measure image height
                const imageEl = document.querySelector('#image-container') || document.querySelector('.flex-1.relative');
                const imageHeight = imageEl ? imageEl.offsetHeight : 0;

                return { finalSize, imageHeight };
            }, { layoutType: L.layoutType });

            const outPath = path.join(OUTPUT_DIR, `${L.name}.png`);
            await page.screenshot({ path: outPath });
            console.log(`✅ ${L.name} | Font: ${validation.finalSize}px | Image Height: ${validation.imageHeight}px`);
        } catch (err) {
            console.error(`❌ Error rendering layout ${L.name}:`, err);
        } finally {
            if (page) await page.close();
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        }
    }
    
    await browser.close();
}

run().catch(console.error);
