const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const templates = [
    { name: '1080x1350_white',  w: 1080, h: 1350, type: '1-point' },
    { name: '1080x1350_green',  w: 1080, h: 1350, type: '2-point' },
    { name: '1080x1350_black',  w: 1080, h: 1350, type: '3-point' },
    { name: '1080x1350_urgent', w: 1080, h: 1350, type: '4-point' }
];

const payloads = {
    '1-point': {
        subHeadline: "خبر سريع",
        mainHeadline: "قرار حكومي جديد",
        imageUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1600&auto=format&fit=crop",
        bullets: ["هذا النص عبارة عن خبر من جملة واحدة يملأ المساحة المتبقية ولا يحتاج إلى ترقيم أو تنقيط بل يعرض كفقرة واحدة متصلة لتوضيح التفاصيل الهامة."]
    },
    '2-point': {
        subHeadline: "اقتصاد",
        mainHeadline: "البنك المركزي يعلن عن حزمة قرارات مالية جديدة",
        imageUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1600&auto=format&fit=crop",
        bullets: [
            "تخفيض نسبة الفائدة على القروض لدعم الشركات الصغيرة والمتوسطة.",
            "إطلاق منصة رقمية لتسهيل الحوالات المالية الدولية بشكل فوري وآمن."
        ]
    },
    '3-point': {
        subHeadline: "تكنولوجيا",
        mainHeadline: "افتتاح مركز ذكاء اصطناعي جديد في دمشق لدعم الجيل القادم",
        imageUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1600&auto=format&fit=crop",
        bullets: [
            "المركز يستهدف تدريب أكثر من 5000 طالب سنوياً على أحدث التقنيات.",
            "المبادرة تمثل خطوة نوعية لتحديث البنية التحتية التكنولوجية في البلاد.",
            "تم توقيع شراكات مع شركات تقنية عالمية لتوفير مناهج متطورة."
        ]
    },
    '4-point': {
        subHeadline: "عاجل",
        mainHeadline: "وزارة التربية تعلن عن خطة العام الدراسي الجديد",
        imageUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1600&auto=format&fit=crop",
        bullets: [
            "اعتماد المناهج الرقمية في جميع المدارس الحكومية بشكل تدريجي.",
            "تأمين أجهزة لوحية للطلاب في المراحل الثانوية مجاناً.",
            "دورات تدريبية مكثفة للمعلمين على استخدام التكنولوجيا.",
            "بدء الدوام الرسمي في الأول من شهر أيلول القادم."
        ]
    }
};

async function run() {
    const browser = await puppeteer.launch({ headless: 'new' });
    
    for (const t of templates) {
        let templateHtml = fs.readFileSync(path.join(__dirname, 'templates', `${t.name}.html`), 'utf8');
        const newsData = payloads[t.type];
        
        // Extract the bullet template
        const match = templateHtml.match(/<meta id="bullet-template" content="(.*?)">/);
        let bulletsHtml = '';
        if (match) {
            const base64Template = match[1];
            const bulletTemplateStr = Buffer.from(base64Template, 'base64').toString('utf8');
            
            bulletsHtml = newsData.bullets.map((b, i) => {
                let numStr = (i + 1).toString().padStart(2, '0');
                let formattedText = b;
                
                // Rule: Green layout has the first two words bolded.
                if (t.name.includes('green')) {
                    const words = b.split(' ');
                    if (words.length >= 2) {
                        formattedText = `<span class="font-bold">${words.slice(0, 2).join(' ')}</span> ${words.slice(2).join(' ')}`;
                    }
                }

                let singleHtml = bulletTemplateStr
                    .replace(/__BULLET_INDEX__/g, numStr)
                    .replace(/__BULLET_TEXT__/g, formattedText);
                
                return singleHtml;
            }).join('');
        }
        
        // Wrap in dynamic Grid Layout with strict min-w-0 bounds
        let gridContainerClass = '';
        if (newsData.bullets.length === 1) {
            // User requested perfect centering for 1-point news
            gridContainerClass = 'flex flex-col items-center justify-center text-center h-full w-full';
            bulletsHtml = bulletsHtml.replace(/text-right/g, 'text-center');
        } else if (newsData.bullets.length === 2) {
            gridContainerClass = 'grid grid-cols-2 gap-4 h-full w-full min-w-0';
        } else if (newsData.bullets.length === 3) {
            gridContainerClass = 'flex flex-col gap-4 h-full w-full min-w-0';
        } else if (newsData.bullets.length === 4) {
            gridContainerClass = 'grid grid-cols-2 grid-rows-2 gap-4 h-full w-full min-w-0';
        }

        bulletsHtml = `<div id="grid-container" class="${gridContainerClass}">${bulletsHtml}</div>`;
        
        let finalHtml = templateHtml
            .replace(/__SUB_HEADLINE__/g, newsData.subHeadline)
            .replace(/__MAIN_IMAGE_URL__/g, newsData.imageUrl)
            .replace(/__BULLETS_HTML__/g, bulletsHtml);
            
        // Dynamic headline formatting
        const hw = newsData.mainHeadline.split(' ');
        let formattedHeadline = newsData.mainHeadline;
        if (hw.length <= 4) {
            // Short sentence: 1 line, all bold
            formattedHeadline = `<span class="font-bold">${newsData.mainHeadline}</span>`;
        } else {
            // 2 lines: Semi-bold then Bold
            const mid = Math.ceil(hw.length / 2);
            const firstPart = hw.slice(0, mid).join(' ');
            const secondPart = hw.slice(mid).join(' ');
            formattedHeadline = `<span class="font-medium">${firstPart}</span><br/><span class="font-bold">${secondPart}</span>`;
        }

        // Base headline classes - Increased per user request
        let headlineClasses = 'text-[60px]';

        finalHtml = finalHtml
            .replace(/__MAIN_HEADLINE__/g, formattedHeadline)
            .replace(/__HEADLINE_CLASSES__/g, headlineClasses);
        
        const tempPath = path.join(__dirname, 'temp_run.html');
        fs.writeFileSync(tempPath, finalHtml);
        
        const page = await browser.newPage();
        await page.setViewport({ width: t.w, height: t.h, deviceScaleFactor: 1 });
        await page.goto(`file://${tempPath}`, { waitUntil: 'networkidle0' });
        
        await page.evaluateHandle('document.fonts.ready');
        await new Promise(r => setTimeout(r, 1000));
        
        // Execute Smart Fallback Algorithm
        const validation = await page.evaluate(({ bulletCount, canvasHeight }) => {
            const headlineEl = document.getElementById('main-headline');
            const headlineLineHeight = parseInt(window.getComputedStyle(headlineEl).lineHeight);
            const headlineFontSize = parseInt(window.getComputedStyle(headlineEl).fontSize);
            const maxHeadlineHeight = headlineLineHeight * 2.5;
            
            if (headlineEl.offsetHeight > maxHeadlineHeight) {
                return { success: false, error: "Headline exceeds 2 lines limit! Must be rewritten." };
            }
            
            const bulletTexts = Array.from(document.querySelectorAll('.bullet-text'));
            const container = document.getElementById('grid-container');
            const bentoParent = document.getElementById('bento-container');
            
            if (bulletTexts.length === 0) return { success: true };

            const isSingleParagraph = bulletCount === 1;
            if (isSingleParagraph) {
                document.querySelectorAll('.bullet-num').forEach(el => el.remove());
            }

            // Core Layout Testing Algorithm
            const testFit = (size, enforceOneLiner) => {
                let allFit = true;
                bulletTexts.forEach(el => {
                    el.style.fontSize = size + 'px';
                    if (enforceOneLiner) {
                        el.style.whiteSpace = 'nowrap';
                        el.style.overflow = 'hidden';
                        // Check horizontal overflow (text bleeds out of box)
                        if (el.scrollWidth > el.clientWidth) allFit = false;
                        // Restore immediately so CSS renders correctly
                        el.style.whiteSpace = 'normal';
                        el.style.overflow = 'visible';
                    }
                });
                // Check if the overall bento container vertically overflowed its 35% firewall constraint
                if (bentoParent.scrollHeight > bentoParent.clientHeight) allFit = false;
                return allFit;
            };

            const findOptimalSize = (startSize, minSize, enforceOneLiner) => {
                let size = startSize;
                while (size >= minSize) {
                    if (testFit(size, enforceOneLiner)) return size;
                    size--;
                }
                return -1; // Failed to fit at minSize
            };

            // Readability Rules
            const maxBulletSize = Math.min(headlineFontSize * 0.6, 34); // Max 34px
            const absoluteMinSize = 26; // Hard readability floor

            if (isSingleParagraph) {
                const finalSize = findOptimalSize(maxBulletSize, absoluteMinSize, false);
                if (finalSize === -1) return { success: false, error: "Content too long! Failed at 26px minimum." };
                return { success: true };
            }

            // Try Optimal Grid (2x2 or 1x2)
            if (bulletCount === 2 || bulletCount === 4) {
                // Try to force 1-liners first at a large, highly readable font size
                const gridFitSize = findOptimalSize(maxBulletSize, 28, true);
                if (gridFitSize !== -1) {
                    return { success: true }; // Optimal Grid Succeeded!
                }
                
                // Fallback Logic
                if (bulletCount === 2) {
                    // For 2 bullets: Abandon side-by-side. Switch to Vertical Stack to give text 1000px to breathe!
                    container.className = 'flex flex-col gap-4 w-full min-w-0';
                    document.querySelectorAll('.bullet-box').forEach(el => {
                        el.classList.remove('h-full');
                        el.classList.add('h-auto');
                    });
                } else if (bulletCount === 4) {
                    // For 1350: MUST stay in 2x2 grid to prevent vertical overflow.
                    // But we must aggressively shrink the font so it doesn't wrap violently in small boxes!
                    const reducedMaxSize = 24; // Force text smaller
                    const wrapGridSize = findOptimalSize(reducedMaxSize, 16, false);
                    if (wrapGridSize === -1) {
                        return { success: false, error: "Copy rejection: 4 Bullets too long for 2x2 grid even at minimum font." };
                    }
                    return { success: true };
                }
            }

            // We are now in Stacked Layout (Default for 3, or fallback for 2)
            // Allow natural wrapping (symmetrical), but enforce the 26px absolute minimum.
            const stackedFitSize = findOptimalSize(maxBulletSize, absoluteMinSize, false);
            
            if (stackedFitSize === -1) {
                return { success: false, error: "Copy rejection: Bullets are too long! Even in stacked layout, text cannot fit safe zone at 26px font." };
            }

            return { success: true };
        }, { bulletCount: newsData.bullets.length, canvasHeight: t.h });

        const outPath = path.join(__dirname, `output_${t.name}.png`);
        await page.screenshot({ path: outPath });

        if (!validation.success) {
            console.error(`❌ Validation Failed for ${t.name}: ${validation.error}`);
            console.log(`⚠️ Screenshot saved as ${outPath} for visual debugging.`);
            await page.close();
            fs.unlinkSync(tempPath);
            continue;
        }
        
        console.log(`✅ Successfully generated ${outPath}`);
        
        await page.close();
        fs.unlinkSync(tempPath);
    }
    
    await browser.close();
}

run().catch(console.error);
