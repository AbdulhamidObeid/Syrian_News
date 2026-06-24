/**
 * curator.js
 * 
 * Editor & Copywriting Orchestrator.
 * Integrates with Google Gemini API to dynamically curate, score, and rewrite 
 * news items into visually constrained bento copy payloads.
 * 
 * Modularly loads configuration and guidelines from:
 * - /Config/brand_config.json
 * - /Config/editor_config.json
 * - /Blueprint/02_editor_copywriter_agent.md
 */

const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

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

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("❌ Error: GEMINI_API_KEY not found in environment or .env file.");
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Phase 1: Score raw feed items to filter high-value candidates
 */
async function scoreNewsFeed(rawItems, activeTopics = []) {
    console.log(`\n--- Phase 1: Curation Scoring (${rawItems.length} items) ---`);
    const modelName = editorConfig.fast_model || 'gemini-2.5-flash';

    let avoidanceInstruction = "";
    if (activeTopics.length > 0) {
        avoidanceInstruction = `
6. RECENT TOPICS AVOIDANCE (CRITICAL):
We have recently published or are currently processing posts about these exact topics:
${activeTopics.map(t => '- ' + t).join('\n')}
If ANY of the news items in your list cover the EXACT SAME story or event as the topics above (even if from a different news source), you MUST score them low and set "selected": false. DO NOT select news we already covered!`;
    }

    const systemInstruction = `
You are the Chief Editor for ${brandConfig.brand.name_arabic} (${brandConfig.brand.name}).
Niche: ${brandConfig.brand.niche}
Target Audience: ${brandConfig.brand.target_audience}
Tone: ${brandConfig.tone_of_voice.archetype} (${brandConfig.tone_of_voice.traits.join(', ')})
Restrictions: ${brandConfig.tone_of_voice.restrictions.join(', ')}

Your task is to evaluate a list of raw news items and score each from 1 to 10 for whether we should publish it on our channels today.

GROWTH PHASE SCORING RUBRIC (we are a new account aggressively building audience):
1. Shareability & Virality (25%): Will people share this? Does it spark emotion, debate, or curiosity? Would someone tag a friend? Topics that affect many people score higher.
2. Daily Utility & Impact (20%): Does it affect daily Syrian life (currency, gold/fuel rates, weather, jobs, electricity, internet, reconstruction)?
3. Audience Relevance (20%): Is it relevant to Syrians inside Syria AND the global diaspora? Local + diaspora appeal scores highest.
4. Social Media Appeal (20%): Will this generate comments, saves, and engagement? Questions, debates, surprising facts, and relatable struggles score high. Dry government meetings score low.
5. Visual Bento Potential (15%): Can the core details be neatly arranged into 1 to 4 clean standalone bullet points for our branded template?
${avoidanceInstruction}

BONUS / SPORTS SCORING (CRITICAL): Only score World Cup/football news highly (>= 7.5) and select it if it directly reports match results (e.g., final scores, winners, group qualification/elimination status). All other general sports news, pre-match expectations, training details, team logistics, or fan comments must be scored low (< 5.0) and set 'selected': false. Important news about Syria (daily life, economy, local events, reconstruction) must always be prioritized and scored much higher than sports.

URGENCY CHECK: If the title or content contains any of these keywords: عاجل, مرسوم, قرار رئاسي, انفجار, عقوبات, زلزال, breaking, خبر عاجل
Then mark "isUrgent": true. Urgent news always gets selected regardless of score.

Selection Threshold: Only items with a score >= ${editorConfig.scoring_threshold} should be selected (unless urgent).
BE GENEROUS with scoring during growth phase — we need volume. If it's remotely interesting to Syrians, lean towards selecting it.
`;

    const model = genAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: systemInstruction
    });

    const scoringSchema = {
        type: "array",
        items: {
            type: "object",
            properties: {
                id: { type: "string" },
                score: { type: "number", description: "Score out of 10 (e.g. 8.5) based on the rubric." },
                rationale: { type: "string" },
                selected: { type: "boolean" },
                isUrgent: { type: "boolean", description: "True if this is breaking/urgent news." }
            },
            required: ["id", "score", "rationale", "selected", "isUrgent"]
        }
    };

    const prompt = `
Please score the following raw news feed and identify the best items for publication.

Raw News Feed (JSON):
${JSON.stringify(rawItems, null, 2)}
`;

    try {
        const response = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.1,
                responseMimeType: "application/json",
                responseSchema: scoringSchema
            }
        });

        const resultText = response.response.text();
        const scoredItems = JSON.parse(resultText);
        
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
const copywritingSchema = {
    type: "object",
    properties: {
        contentType: { type: "string", enum: ["green", "white", "black", "urgent"] },
        isCarousel: { type: "boolean", description: "Set to true if this should be a multi-image carousel." },
        subHeadline: { type: "string", description: "Short 1-2 word Arabic topic tag (e.g. اقتصاد, طقس, رياضة, ثقافة, تكنولوجيا, خبر سريع)." },
        headlineStyle: { type: "string", enum: ["T1", "T2"] },
        headline: {
            type: "object",
            properties: { line1: { type: "string" }, line2: { type: "string" } },
            required: ["line1"]
        },
        points: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 },
        imageUrl: { type: "string", description: "Original news image URL, if available from the source." },
        imageStrategy: { type: "string", enum: ["generate", "reference"], description: "Use 'reference' if the news mentions specific people (names, figures, specific individuals, or groups of people) whose exact/similar face resemblance is necessary, and we have an image URL in the article (Original Image URL is not 'No image available'). Otherwise, use 'generate'." },
        imagePrompt: { type: "string", description: "Visual generation prompt in English. Must be highly detailed." },
        slides: {
            type: "array",
            description: "Required if isCarousel is true. Array of slide objects.",
            items: {
                type: "object",
                properties: {
                    type: { type: "string", enum: ["hook", "body", "cta"] },
                    layoutType: { type: "string", enum: ["1-box", "2-stack", "2-side", "3-stack", "3-mixed-top", "3-mixed-bottom", "4-grid"] },
                    headline: { type: "object", properties: { line1: { type: "string" }, line2: { type: "string" } } },
                    imagePrompt: { type: "string" },
                    points: { type: "array", items: { type: "string" } },
                    ctaText: { type: "string" }
                },
                required: ["type"]
            }
        },
        socialMediaCaptionLong: { type: "string", description: "Long, engaging caption for FB/IG with many hashtags." },
        socialMediaCaptionShort: { type: "string", description: "Strictly concise caption for X (under 240 chars) with essential hashtags." }
    },
    required: ["contentType", "isCarousel", "subHeadline", "imageStrategy", "socialMediaCaptionLong", "socialMediaCaptionShort"]
};

async function copywriteNewsItem(selectedItem, isFallback = false) {
    console.log(`\n--- Phase 2: Copywriting Rewrite (ID: ${selectedItem.id}${isFallback ? ' - FALLBACK MODE' : ''}) ---`);
    const modelName = isFallback ? (editorConfig.fast_model || 'gemini-2.5-flash') : (editorConfig.heavy_model || 'gemini-2.5-pro');

    const systemInstruction = `
You are the Lead Copywriter for ${brandConfig.brand.name_arabic} (${brandConfig.brand.name}).
Niche: ${brandConfig.brand.niche}
Target Audience: ${brandConfig.brand.target_audience}
Tone: ${brandConfig.tone_of_voice.archetype} (${brandConfig.tone_of_voice.traits.join(', ')})
Restrictions: ${brandConfig.tone_of_voice.restrictions.join(', ')}

Follow these strict copywriting guidelines:
${copywritingGuidelines}

Your task is to take the selected news article details and rewrite it into a structured copy payload for our designer engine.
Output must follow the designated bento layout rules (T1/T2 headlines, point limits, and Standard Arabic styling).

CRITICAL HEADLINE WORD COUNT CONSTRAINT (STRICT 2-LINE MAX):
- For T1 headlines (headlineStyle: "T1"), the headline MUST be on a single line (line1) and contain a maximum of 4 to 5 words.
- For T2 headlines (headlineStyle: "T2"), you MUST split the headline across line1 and line2. The TOTAL word count across BOTH lines combined MUST NOT exceed 10 to 12 words (e.g. 5-6 words per line). This is a strict visual limit. If a headline has too many words, it will wrap to 3 lines (which is strictly forbidden) or be truncated with dots. Keep it concise, punchy, and under this limit.

CRITICAL LAYOUT DECISION RULE:
The number of points you generate directly determines the visual layout template the Designer will use for single-image posts:
- 1 point -> '1-box' layout (Use for very short, single-focus news)
- 2 points -> '2-stack' or '2-side' layout (Use for comparative or cause-effect news)
- 4 points -> '4-grid' layout (Use for complex news with many details)

CRITICAL FORMAT DECISION RULE (Single Post vs Carousel):
Based on the depth of the story, you must decide whether it should be a Single Post or a Carousel.
ONLY choose Carousel if the story is a complex, multi-faceted deep dive that has enough depth to fill AT LEAST 3 full body slides. If the story is a standard update or has 4 main points or less, you MUST set "isCarousel": false, and use the "headline", "imagePrompt", and "points" fields at the root level (utilizing the 4-grid layout).
For Carousels (isCarousel: true):
- Slide 1: type "hook", with a headline and imagePrompt.
- Slides 2 to (N-1): type "body" with "layoutType" set to "1-box". You MUST provide EXACTLY ONE string in the "points" array containing EXACTLY 3 distinct sentences/paragraphs separated by the HTML tag "<br>". Do NOT use newline characters.
- There MUST be at least 3 body slides (total minimum of 5 slides including hook and CTA).
- Slide N (the last slide): type "cta", with "ctaText" containing ONLY a generic two-word phrase like "التفاصيل والمعلومات".
When "isCarousel" is true, omit root-level "points", "headline", and "imagePrompt".
CRITICAL IMAGE STRATEGY RULE (APPLIES TO BOTH SINGLE POSTS AND CAROUSELS):
- If the news is about a specific person, a specific event, a specific object, or anything specific whose visual context or resemblance is important (e.g., a serious topic involving a specific person, sports match, or landmark) and we have an image URL from the scraped news (Original Image URL is not 'No image available'), you MUST set "imageStrategy": "reference" to use that image as a reference.
  * If you set "imageStrategy": "reference", the "imagePrompt" MUST NOT describe the news article details or write a new custom scene. Instead, you MUST write a prompt in a proper prompt way to recreate the reference image, formatted exactly as: "A high-quality, realistic photo of [main topic/subject of the reference image], recreating the exact same reference image with all its details, same features, and subjects, shot from a slightly different camera angle, with no watermarks."
  * If you want to depict a different, more general or illustrative scene that does not match the reference image (e.g., depicting a generic post office counter instead of the specific signing ceremony), you MUST set "imageStrategy": "generate" to ignore the reference image.
- Only set "imageStrategy": "generate" (text-only prompt) if the news is about a very general/abstract topic (like general economy, weather, abstract concepts), if there is no image URL in the news source, or if the original image is irrelevant/mismatched to the scene you want to depict.
- For BOTH strategies, write a photorealistic prompt in English describing what the image should look like.
- AI IMAGE SAFETY & SYMBOLISM RULES (CRITICAL):
  * Do NOT inject or add flags, logos, emblems, maps, or other political/national symbols into the prompt unless they are explicitly mentioned/requested in the news text. Most real-world scenes (like a street, a market, a petrol station) do not have flags or official emblems. Keep the scene realistic and clutter-free.
  * If (and ONLY if) a Syrian flag is explicitly requested or central to the news context, you MUST write "the Syrian Revolution flag with green, white, and black horizontal stripes and three red stars in the middle". NEVER write "Syrian flag" without this description.
  * NEVER use generic terms like "Syrian president", "Syrian diplomat", or "Syrian leader" WITHOUT explicitly naming the person, as the AI will default to generating Bashar Al-Assad. If the news is about a specific person, you MUST name them explicitly in the prompt (e.g. "Portrait of Jihad Makdissi, a Syrian diplomat") AND you MUST set "imageStrategy": "reference" if an Original Image URL is provided.

- Do NOT be vague. If the news is about "Morocco vs Scotland", explicitly say "Morocco flag and Scotland flag" or "Morocco football players playing against Scotland football players in stadium".
- DO NOT hallucinate details that conflict with the news (e.g. don't write Portugal if the news says Scotland).
- The image MUST look realistic, cinematic, and NOT like generic AI slop. It MUST resemble the Syrian or Arab context where applicable.

CRITICAL CAPTION & HASHTAG RULE (DUAL OUTPUT):
You MUST generate TWO distinct captions:
1. "socialMediaCaptionLong": For Facebook and Instagram. This must be informative, engaging, include a question for engagement, and span 2 to 3 sentences. You MUST use a newline character '\\n' to separate the main text from the hashtags. Include the mandatory hashtags "${brandConfig.brand.hashtags.join(' ')}" PLUS 3 to 5 additional highly relevant hashtags to maximize exposure.
2. "socialMediaCaptionShort": For X (Twitter). This must be extremely concise, straight to the point, and strictly under 240 characters total. Use a newline '\\n' before hashtags. Include the mandatory hashtags "${brandConfig.brand.hashtags.join(' ')}" PLUS only 1 or 2 extra highly relevant hashtags.

Example format for Long:
"This is an informative, engaging caption about the news... What do you think about this issue?
\\n
#Mandatory #Hashtags #Relevant1 #Relevant2 #Relevant3 #Relevant4"`;

    const model = genAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: systemInstruction
    });

    const prompt = `
Rewrite the following article details:
Title: ${selectedItem.title}
Content: ${selectedItem.description || selectedItem.content || ''}
Original Image URL: ${selectedItem.imageUrl || 'No image available'}
`;

    try {
        const response = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: editorConfig.temperature || 0.3,
                topP: editorConfig.top_p || 0.9,
                responseMimeType: "application/json",
                responseSchema: copywritingSchema
            }
        });

        const resultText = response.response.text();
        const payload = JSON.parse(resultText);

        // Inject the original imageUrl from the scout data
        if (selectedItem.imageUrl && !payload.imageUrl) {
            payload.imageUrl = selectedItem.imageUrl;
        }

        // Post-generation validation
        validateCopywriterPayload(payload);

        return payload;
    } catch (error) {
        console.error(`❌ Error copywriting item ${selectedItem.id} using model ${modelName}:`, error.message || error);
        
        if (!isFallback && editorConfig.fast_model && editorConfig.fast_model !== modelName) {
            console.log(`⚠️ Attempting fallback curation with model: ${editorConfig.fast_model}`);
            return await copywriteNewsItem(selectedItem, true);
        }
        
        throw error;
    }
}

/**
 * Phase 2b: Refine/modify copywriting payload based on admin feedback
 */
async function refineCopywriteNewsItem(selectedItem, previousPayload, feedback, isFallback = false) {
    console.log(`\n--- Phase 2b: Copywriting Refinement (ID: ${selectedItem.id}${isFallback ? ' - FALLBACK MODE' : ''}) ---`);
    const modelName = isFallback ? (editorConfig.fast_model || 'gemini-2.5-flash') : (editorConfig.heavy_model || 'gemini-2.5-pro');

    const systemInstruction = `
You are the Lead Copywriter for ${brandConfig.brand.name_arabic} (${brandConfig.brand.name}).
Niche: ${brandConfig.brand.niche}
Target Audience: ${brandConfig.brand.target_audience}
Tone: ${brandConfig.tone_of_voice.archetype} (${brandConfig.tone_of_voice.traits.join(', ')})
Restrictions: ${brandConfig.tone_of_voice.restrictions.join(', ')}

Follow these strict copywriting guidelines:
${copywritingGuidelines}

We have already generated a post payload, but the Admin requested changes to the content, headline, or caption.
Your task is to refine the previous copywriting payload based on the Admin's feedback.

Previous Copywriting Payload:
${JSON.stringify(previousPayload, null, 2)}

Admin Feedback/Modification Request:
"${feedback}"

Ensure you ONLY change the text or styling as requested by the feedback. Keep all other fields, image prompts, image strategy, and structures intact unless specifically requested to change them.
CRITICAL HEADLINE CONSTRAINT:
- If you rewrite the headline, it MUST adhere strictly to the word limits:
  * For T1: 4-5 words max (single line: line1).
  * For T2: 10-12 words max in total combined across line1 and line2.
  * If the headline has trailing dots, or was cut off, you MUST rewrite it to be shorter and cleaner while keeping the news value.
`;

    const model = genAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: systemInstruction
    });

    const prompt = `Please apply the admin feedback to refine the payload.
Feedback: "${feedback}"

Original Article Context (refer to this if asked to rewrite or shorten content/headlines):
Title: ${selectedItem.title || ''}
Content: ${selectedItem.description || selectedItem.content || ''}
`;

    try {
        const response = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json",
                responseSchema: copywritingSchema
            }
        });

        const resultText = response.response.text();
        const payload = JSON.parse(resultText);

        if (previousPayload.imageUrl && !payload.imageUrl) {
            payload.imageUrl = previousPayload.imageUrl;
        }

        validateCopywriterPayload(payload);
        return payload;
    } catch (error) {
        console.error(`❌ Error refining copywriting item ${selectedItem.id}:`, error.message || error);
        if (!isFallback && editorConfig.fast_model && editorConfig.fast_model !== modelName) {
            console.log(`⚠️ Attempting fallback refinement with model: ${editorConfig.fast_model}`);
            return await refineCopywriteNewsItem(selectedItem, previousPayload, feedback, true);
        }
        throw error;
    }
}

/**
 * Phase 2c: Refine ONLY the image prompt based on admin feedback
 */
async function refineImagePrompt(previousPayload, feedback) {
    console.log(`\n--- Phase 2c: Image Prompt Refinement ---`);
    const modelName = editorConfig.fast_model || 'gemini-2.5-flash';
    const model = genAI.getGenerativeModel({ model: modelName });
    
    const payload = previousPayload || {};
    const previousPrompt = payload.imagePrompt || (payload.slides && payload.slides[0] && payload.slides[0].imagePrompt) || '';
    const subHeadline = payload.subHeadline || '';
    const headlineText = payload.headline 
        ? `${payload.headline.line1 || ''} ${payload.headline.line2 || ''}`.trim()
        : '';
    const pointsText = Array.isArray(payload.points)
        ? payload.points.join('\n')
        : '';
    const prompt = `You are a creative director. We have an image prompt representing a news item for an AI image generator.

=== News Context ===
Category/Topic: ${subHeadline}
Headline: ${headlineText}
Key Points:
${pointsText}

=== Previous Image Prompt ===
"${previousPrompt}"

=== User Modification Feedback ===
"${feedback}"

=== Instructions ===
Rewrite the English image prompt to incorporate the user's feedback.

Be smart and analyze the relationship between the previous image prompt and the user's feedback:
1. **Scene/Location/Environment Replacement**:
   - If the user's feedback requests a change in the location, setting, or environment (e.g. from an office/meeting room to a petrol station, or from a street to an indoor room), you MUST completely REPLACE the old setting/location with the new one.
   - Do NOT blend or mix incompatible environments (e.g., do NOT keep meeting room furniture, office walls, or indoor office features if the new location is a petrol station or a street).
   - Ensure the new environment is clean, logical, and fully depicted without remnants of the previous location.
2. **Composition & Object Focus**:
   - If the feedback requests focus on a specific object or close-up composition (e.g., "a fuel pump nozzle", "a close-up of a product", "specific person's hands"), describe EXACTLY that close-up composition.
   - Do NOT add unnecessary background clutter (such as large buildings, wide landscapes, maps, flags, desks) that distracts from the requested object focus unless explicitly requested.
3. **Subject & Topic Consistency**:
   - Preserve the main human subject(s) or entities (e.g. a specific diplomat, worker, or vehicle) and the core journalistic topic, but transplant them entirely into the new setting.
4. **Detail Adjustment**:
   - If the feedback only requests minor details of the current scene (e.g. adding a flag, changing clothes, adjusting lighting, or changing the time of day), keep the current scene structure and apply the specific modification.
5. **Style & Quality**:
   - Maintain a highly realistic, photorealistic, high-quality style. Avoid watermarks, text overlay, or artificial elements.

CRITICAL AI IMAGE SAFETY & SYMBOLISM RULES:
- Do NOT inject or add flags, logos, emblems, maps, or other political/national symbols into the prompt unless they are explicitly mentioned/requested in the user's feedback or the news context.
- Never assume that mentioning "Syria" or a Syrian city/location implies that a flag, coat of arms, or emblem should be present. Keep the scene realistic and clutter-free.
- If (and ONLY if) a Syrian flag is explicitly requested or implied by the feedback, you MUST write "the Syrian Revolution flag with green, white, and black horizontal stripes and three red stars in the middle". NEVER write "Syrian flag".
- If (and ONLY if) a government logo, official document, or coat of arms is explicitly requested or implied by the feedback, you MUST specify "The new Syrian national emblem (launched in July 2025), which is the Syrian Golden Eagle (Eastern Imperial Eagle)". NEVER use the old eagle logo or the Hawk of Quraish.
- NEVER use generic terms like "Syrian president", "Syrian diplomat", or "Syrian leader" WITHOUT explicitly naming the person. If the news is about a specific person, you MUST name them explicitly in the prompt.

Return ONLY the new rewritten image prompt text in English.`;

    const response = await model.generateContent(prompt);
    return response.response.text().trim();
}

/**
 * Validates copywriting constraints
 */
function validateCopywriterPayload(payload) {
    // Caption length check
    if (payload.socialMediaCaption && payload.socialMediaCaption.length > 200) {
        console.warn(`⚠️ Warning: Caption is ${payload.socialMediaCaption.length} chars (max 200). Truncating.`);
        // Find the last space before 200 chars and truncate
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
                    description: item.description || item.content || ''
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
            console.log(`⏳ Waiting 15 seconds before processing the next item...`);
            await sleep(15000);
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
