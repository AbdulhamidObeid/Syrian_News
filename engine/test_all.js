const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const templates = [
    { name: '1080x1350_white',  w: 1080, h: 1350 },
    { name: '1080x1350_green',  w: 1080, h: 1350 },
    { name: '1080x1350_black',  w: 1080, h: 1350 },
    { name: '1080x1350_urgent', w: 1080, h: 1350 },
    { name: '1080x1920_white',  w: 1080, h: 1920 },
    { name: '1080x1920_green',  w: 1080, h: 1920 },
    { name: '1080x1920_black',  w: 1080, h: 1920 },
    { name: '1080x1920_urgent', w: 1080, h: 1920 }
];

const newsData = {
    subHeadline: "تطورات الساحة السورية",
    mainHeadline: "اتفاق جديد يفتح المعابر التجارية بين المحافظات السورية",
    imageUrl: "https://images.unsplash.com/photo-1542382156909-9ae37b3f56fd?q=80&w=1600&auto=format&fit=crop",
    bullets: [
        "الاتفاق يشمل تسهيل حركة البضائع والمدنيين عبر خطوط التماس.",
        "انخفاض ملحوظ في أسعار السلع الأساسية في الأسواق المحلية.",
        "ترحيب شعبي واسع بالخطوة التي تساهم في إنعاش الاقتصاد السوري."
    ]
};

async function run() {
    const browser = await puppeteer.launch({ headless: 'new' });
    
    for (const t of templates) {
        let templateHtml = fs.readFileSync(path.join(__dirname, 'templates', `${t.name}.html`), 'utf8');
        
        // Extract the bullet template from the meta tag
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

                return bulletTemplateStr
                    .replace(/__BULLET_INDEX__/g, numStr)
                    .replace(/__BULLET_TEXT__/g, formattedText);
            }).join('');
        }
        
        let finalHtml = templateHtml
            .replace(/__SUB_HEADLINE__/g, newsData.subHeadline)
            .replace(/__MAIN_IMAGE_URL__/g, newsData.imageUrl)
            .replace(/__BULLETS_HTML__/g, bulletsHtml);
            
        // Dynamic headline formatting (multi-weight) - Logical 50/50 split
        const hw = newsData.mainHeadline.split(' ');
        let formattedHeadline = newsData.mainHeadline;
        if (hw.length >= 2) {
            // Split right at the middle (or just after for odd numbers) to make 2 logical chunks
            const mid = Math.ceil(hw.length / 2);
            const firstPart = hw.slice(0, mid).join(' ');
            const secondPart = hw.slice(mid).join(' ');
            formattedHeadline = `<span class="font-medium">${firstPart}</span><br/><span class="font-bold">${secondPart}</span>`;
        }

        // Dynamic headline classes based on length
        let headlineClasses = 'text-[56px]'; // Increased font size for 1350
        if (t.name.includes('1920')) headlineClasses = 'text-[64px]'; // Larger for 1920

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
        
        const outPath = path.join(__dirname, `output_${t.name}.png`);
        await page.screenshot({ path: outPath });
        console.log(`Successfully generated ${outPath}`);
        
        await page.close();
        fs.unlinkSync(tempPath);
    }
    
    await browser.close();
}

run().catch(console.error);
