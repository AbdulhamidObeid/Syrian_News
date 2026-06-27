/**
 * curator.js
 * 
 * Editor & Copywriting Orchestrator.
 * Integrates with Python google.antigravity SDK to dynamically curate, score, and rewrite 
 * news items into visually constrained bento copy payloads.
 * 
 * Modularly loads configuration and guidelines from:
 * - /Config/brand_config.json
 * - /Config/editor_config.json
 * - /Blueprint/02_editor_copywriter_agent.md
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Load Configuration and Blueprints
const brandConfigPath = path.join(__dirname, '../../Config/brand_config.json');
const editorConfigPath = path.join(__dirname, '../../Config/editor_config.json');
const blueprintPath = path.join(__dirname, '../../Blueprint/02_editor_copywriter_agent.md');

if (!fs.existsSync(brandConfigPath)) {
    console.error(`❌ Error: Brand config missing at ${brandConfigPath}`);
    process.exit(1);
}
if (!fs.existsSync(editorConfigPath)) {
    console.error(`❌ Error: Editor config missing at ${editorConfigPath}`);
    process.exit(1);
}
if (!fs.existsSync(blueprintPath)) {
    console.error(`❌ Error: Blueprint file missing at ${blueprintPath}`);
    process.exit(1);
}

const brandConfig = JSON.parse(fs.readFileSync(brandConfigPath, 'utf8'));
const editorConfig = JSON.parse(fs.readFileSync(editorConfigPath, 'utf8'));
const copywritingGuidelines = fs.readFileSync(blueprintPath, 'utf8');

// Temporary bridge directory for Python interop
const TEMP_BRIDGE_DIR = path.join(__dirname, 'temp_bridge');
if (!fs.existsSync(TEMP_BRIDGE_DIR)) {
    fs.mkdirSync(TEMP_BRIDGE_DIR, { recursive: true });
}

function callPythonCurator(command, payloadObj) {
    const runId = Date.now() + Math.floor(Math.random() * 1000);
    const inputPath = path.join(TEMP_BRIDGE_DIR, `in_${command}_${runId}.json`);
    const outputPath = path.join(TEMP_BRIDGE_DIR, `out_${command}_${runId}.json`);
    
    fs.writeFileSync(inputPath, JSON.stringify(payloadObj, null, 2), 'utf8');
    
    try {
        const pythonScript = path.join(__dirname, 'curator.py');
        execSync(`/opt/homebrew/bin/python3.10 ${pythonScript} ${command} ${inputPath} ${outputPath}`, { stdio: 'inherit' });
        
        if (fs.existsSync(outputPath)) {
            const result = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);
            return result;
        } else {
            throw new Error(`Python script did not produce output file: ${outputPath}`);
        }
    } catch (error) {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        throw error;
    }
}

/**
 * Phase 1: Score raw feed items to filter high-value candidates
 */
async function scoreNewsFeed(rawItems, activeTopics = []) {
    console.log(`\n--- Phase 1: Curation Scoring (${rawItems.length} items) [via Antigravity SDK] ---`);
    
    const payload = {
        rawItems,
        activeTopics,
        editorConfig,
        brandConfig
    };
    
    try {
        const scoredItems = callPythonCurator('score', payload);
        
        console.log("Curation Scoring Results:");
        scoredItems.forEach(item => {
            const urgent = item.isUrgent ? " 🚨 URGENT" : "";
            const status = item.selected ? "✅ SELECTED" : "❌ REJECTED";
            console.log(` - ID ${item.id} | Score: ${item.score}/10 | ${status}${urgent} | ${item.rationale}`);
        });

        return scoredItems;
    } catch (error) {
        console.error("❌ Error in Phase 1 Curation Scoring:", error);
        throw error;
    }
}

/**
 * Phase 2: Copywrite/rewrite a selected item into visual templates
 */
async function copywriteNewsItem(selectedItem, isFallback = false) {
    console.log(`\n--- Phase 2: Copywriting Rewrite (ID: ${selectedItem.id}) [via Antigravity SDK] ---`);
    
    const payload = {
        selectedItem,
        brandConfig,
        copywritingGuidelines
    };
    
    try {
        const result = callPythonCurator('copywrite', payload);
        
        // Inject the original imageUrl from the scout data
        if (selectedItem.imageUrl && !result.imageUrl) {
            result.imageUrl = selectedItem.imageUrl;
        }
        
        validateCopywriterPayload(result);
        return result;
    } catch (error) {
        console.error(`❌ Error copywriting item ${selectedItem.id}:`, error.message || error);
        throw error;
    }
}

/**
 * Phase 2b: Refine/modify copywriting payload based on admin feedback
 */
async function refineCopywriteNewsItem(selectedItem, previousPayload, feedback, isFallback = false) {
    console.log(`\n--- Phase 2b: Copywriting Refinement (ID: ${selectedItem.id}) [via Antigravity SDK] ---`);
    
    const payload = {
        selectedItem,
        previousPayload,
        feedback,
        brandConfig,
        copywritingGuidelines
    };
    
    try {
        const result = callPythonCurator('refine_copywrite', payload);
        
        if (previousPayload.imageUrl && !result.imageUrl) {
            result.imageUrl = previousPayload.imageUrl;
        }

        validateCopywriterPayload(result);
        return result;
    } catch (error) {
        console.error(`❌ Error refining copywriting item ${selectedItem.id}:`, error.message || error);
        throw error;
    }
}

/**
 * Phase 2c: Refine ONLY the image prompt based on admin feedback
 */
async function refineImagePrompt(previousPayload, feedback) {
    console.log(`\n--- Phase 2c: Image Prompt Refinement [via Antigravity SDK] ---`);
    
    const payload = {
        previousPayload,
        feedback
    };
    
    try {
        const result = callPythonCurator('refine_image', payload);
        return result.imagePrompt;
    } catch (error) {
        console.error("❌ Image prompt refinement failed:", error);
        throw error;
    }
}

/**
 * Validates copywriting constraints
 */
function validateCopywriterPayload(payload) {
    // Caption length check
    if (payload.socialMediaCaption && payload.socialMediaCaption.length > 200) {
        console.warn(`⚠️ Warning: Caption is ${payload.socialMediaCaption.length} chars (max 200). Truncating.`);
        const hashtags = `\n${brandConfig.brand.hashtags.join(' ')}`;
        const maxTextLen = 200 - hashtags.length;
        const truncated = payload.socialMediaCaption.substring(0, maxTextLen).trim();
        payload.socialMediaCaption = truncated + hashtags;
    }

    if (payload.isCarousel) return; // Skip single-post constraints for carousels

    // T1 headline constraint: 3-4 words
    if (payload.headlineStyle === 'T1' && payload.headline && payload.headline.line1) {
        const words = payload.headline.line1.trim().split(/\s+/);
        if (words.length > 5) {
            console.warn(`⚠️ Warning: T1 Headline has ${words.length} words (max is 4-5): "${payload.headline.line1}"`);
        }
    }

    // T2 headline constraint: combined max 10-12 words
    if (payload.headlineStyle === 'T2' && payload.headline) {
        const line1Words = (payload.headline.line1 || '').trim().split(/\s+/).filter(Boolean).length;
        const line2Words = (payload.headline.line2 || '').trim().split(/\s+/).filter(Boolean).length;
        const totalWords = line1Words + line2Words;
        if (totalWords > 12) {
            console.warn(`⚠️ Warning: T2 Headline has ${totalWords} words (max is 12). Line 1: ${line1Words}, Line 2: ${line2Words}. Headline: "${payload.headline.line1} - ${payload.headline.line2}"`);
        }
    }

    // 3-stack bullet constraint: max 7-8 words per bullet
    if (payload.points && payload.points.length === 3) {
        payload.points.forEach((point, idx) => {
            const words = point.trim().split(/\s+/);
            if (words.length > 8) {
                console.warn(`⚠️ Warning: Point ${idx + 1} in 3-stack has ${words.length} words (max is 7-8): "${point}"`);
            }
        });
    }
}

/**
 * Main orchestration function
 */
async function runCurator(rawFeedPath, outputDir, activeTopics = []) {
    if (!fs.existsSync(rawFeedPath)) {
        console.error(`❌ Feed file not found at ${rawFeedPath}`);
        return [];
    }

    const rawFeed = JSON.parse(fs.readFileSync(rawFeedPath, 'utf8'));
    
    // Safety check: ensure all items have an ID
    rawFeed.forEach((item, index) => {
        if (!item.id) item.id = `scout_${Date.now()}_${index}`;
    });

    const scoredFeed = await scoreNewsFeed(rawFeed, activeTopics);

    const selectedItems = rawFeed.filter(item => {
        const scored = scoredFeed.find(s => String(s.id) === String(item.id));
        return scored && scored.selected;
    });

    // Attach urgency flag to selected items
    selectedItems.forEach(item => {
        const scored = scoredFeed.find(s => String(s.id) === String(item.id));
        if (scored) {
            item.score = scored.score;
            item.isUrgent = scored.isUrgent || false;
        }
    });

    if (selectedItems.length === 0) {
        console.log("ℹ️ No items met the quality threshold for publishing today.");
        return [];
    }

    console.log(`\nSelected ${selectedItems.length} items for rewriting.`);
    const processedPayloads = [];

    for (const item of selectedItems) {
        try {
            const payload = await copywriteNewsItem(item);
            processedPayloads.push({
                originalId: item.id,
                score: item.score,
                isUrgent: item.isUrgent,
                payload: payload,
                originalItem: {
                    title: item.title || '',
                    description: item.description || item.content || '',
                    imageUrl: item.imageUrl || '',
                    link: item.link || ''
                }
            });
            
            // Output payload file
            if (outputDir) {
                if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
                const outPath = path.join(outputDir, `post_${item.id}.json`);
                fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
                console.log(`✅ Copywriting payload written to ${outPath}`);
            }

            // Rate limit protection
            console.log(`⏳ Waiting 5 seconds before processing the next item...`);
            await sleep(5000);
        } catch (err) {
            console.error(`❌ Failed to curate news item ${item.id}:`, err);
        }
    }

    return processedPayloads;
}

// CLI / Test Execution Block
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--test')) {
        console.log("🚀 Running Curator Self-Test Workflow...");
        
        const testFeed = [
            {
                id: "101",
                title: "ارتفاع تاريخي لأسعار الذهب بدمشق اليوم السبت",
                description: "سجل غرام الذهب عيار 21 قيراط سعراً قياسياً جديداً في الأسواق السورية صباح اليوم، حيث بلغ 950 ألف ليرة سورية للغرام الواحد، وسط تراجع مستمر في قيمة الليرة والقدرة الشرائية للمواطنين.",
                imageUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1600&auto=format&fit=crop"
            },
            {
                id: "102",
                title: "فوز المنتخب السوري لكرة القدم ودياً على نظيره اللبناني بهدفين لهدف",
                description: "تمكن منتخب سوريا الوطني لكرة القدم من الفوز ودياً على نظيره اللبناني بنتيجة 2-1 في المباراة التي أقيمت بملعب المدينة الرياضية، في إطار التحضيرات للتصفيات الآسيوية المشتركة.",
                imageUrl: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1600&auto=format&fit=crop"
            }
        ];

        (async () => {
            try {
                const scoredResult = await scoreNewsFeed(testFeed);
                const selected = testFeed.filter(item => {
                    const scored = scoredResult.find(s => s.id === item.id);
                    return scored && scored.selected;
                });
                
                console.log(`\nCurator selected ${selected.length} items out of ${testFeed.length}.`);
                
                for (const item of selected) {
                    const payload = await copywriteNewsItem(item);
                    console.log(`\nPayload output for ID ${item.id}:`, JSON.stringify(payload, null, 2));
                }
            } catch (err) {
                console.error("❌ Curator self-test workflow failed:", err);
            }
        })();
    } else {
        const feedPath = args[0] || path.join(__dirname, '../Scout_Engine/feed.json');
        const outputDir = args[1] || path.join(__dirname, '../Designer_Engine/copy_input');
        
        console.log(`Curating news feed from: ${feedPath}`);
        runCurator(feedPath, outputDir)
            .then(() => console.log("\nPipeline Curation Complete."))
            .catch(console.error);
    }
}

module.exports = {
    scoreNewsFeed,
    copywriteNewsItem,
    runCurator,
    refineCopywriteNewsItem,
    refineImagePrompt
};
