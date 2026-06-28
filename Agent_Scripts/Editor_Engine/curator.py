import os
import sys
import json
import asyncio
from typing import List, Optional
import pydantic
from google.antigravity import Agent, LocalAgentConfig

# Ensure environment variables are loaded
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env'))

# --- Pydantic Schemas for Structured Output ---

class ScoredItem(pydantic.BaseModel):
    id: str
    score: float = pydantic.Field(description="Score out of 10 (e.g. 8.5) based on the rubric.")
    rationale: str
    selected: bool
    isUrgent: bool = pydantic.Field(description="True if this is breaking/urgent news.")

class ScoringSchema(pydantic.BaseModel):
    items: List[ScoredItem]

class Headline(pydantic.BaseModel):
    line1: str
    line2: Optional[str] = None

class Slide(pydantic.BaseModel):
    type: str
    layoutType: Optional[str] = None
    headline: Optional[Headline] = None
    imagePrompt: Optional[str] = None
    points: Optional[List[str]] = None
    ctaText: Optional[str] = None

class CopywritingSchema(pydantic.BaseModel):
    contentType: str
    isCarousel: bool = pydantic.Field(description="Set to true if this should be a multi-image carousel.")
    subHeadline: str = pydantic.Field(description="Short 1-2 word Arabic topic tag (e.g. اقتصاد, طقس, رياضة, ثقافة, تكنولوجيا, خبر سريع).")
    headlineStyle: Optional[str] = None
    headline: Optional[Headline] = None
    points: Optional[List[str]] = None
    imageUrl: Optional[str] = pydantic.Field(default=None, description="Original news image URL, if available from the source.")
    imageStrategy: str = pydantic.Field(description="Use 'reference' if the news mentions specific people (names, figures, specific individuals, or groups of people) whose exact/similar face resemblance is necessary, and we have an image URL in the article (Original Image URL is not 'No image available'). Otherwise, use 'generate'.")
    imagePrompt: Optional[str] = pydantic.Field(default=None, description="Visual generation prompt in English. Must be highly detailed.")
    slides: Optional[List[Slide]] = pydantic.Field(default=None, description="Required if isCarousel is true. Array of slide objects.")
    socialMediaCaptionLong: str = pydantic.Field(description="Long, engaging caption for FB/IG with many hashtags.")
    socialMediaCaptionShort: str = pydantic.Field(description="Strictly concise caption for X (under 240 chars) with essential hashtags.")

class ImagePromptSchema(pydantic.BaseModel):
    imagePrompt: str

# --- Core Functions ---

async def score_feed(input_path: str, output_path: str):
    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    raw_items = data.get("rawItems", [])
    active_topics = data.get("activeTopics", [])
    editor_config = data.get("editorConfig", {})
    brand_config = data.get("brandConfig", {})
    
    avoidance_instruction = ""
    if active_topics:
        topics_list = "\n".join([f"- {t}" for t in active_topics])
        avoidance_instruction = f"""
6. RECENT TOPICS AVOIDANCE (CRITICAL):
We have recently published or are currently processing posts about these exact topics:
{topics_list}
If ANY of the news items in your list cover the EXACT SAME story or event as the topics above (even if from a different news source), you MUST score them low and set "selected": false. DO NOT select news we already covered!"""

    system_instruction = f"""You are the Chief Editor for {brand_config.get('brand', {}).get('name_arabic', '')}.
Niche: {brand_config.get('brand', {}).get('niche', '')}
Tone: {brand_config.get('tone_of_voice', {}).get('archetype', '')}

Your task is to evaluate a list of raw news items and score each from 1 to 10 for whether we should publish it on our channels today.

GROWTH PHASE SCORING RUBRIC (we are a new account aggressively building audience):
1. Shareability & Virality (25%): Will people share this? Focus on IMPORTANT things, appealing news, Syrian achievements, and positive viral trending topics.
2. Daily Utility & Impact (20%): Does it affect daily Syrian life (currency, gold/fuel rates, weather, jobs, electricity)?
3. Audience Relevance (20%): Is it relevant to Syrians inside Syria AND the global diaspora?
4. Social Media Appeal (20%): Will this generate comments, saves, and engagement? Avoid boring/generic government meetings.
5. Visual Bento Potential (15%): Can the core details be neatly arranged into 1 to 4 clean bullet points for our branded template? Make use of ALL color categories.
{avoidance_instruction}

BONUS / SPORTS / GLOBAL SCORING (CRITICAL): World Cup results are IMPORTANT (especially if an Arabic team is playing, but all results are good). You MUST score World Cup results highly. Also, score worldwide similar events highly if they are important and appeal to Syrians. Do NOT ignore global trending events if they matter to the audience.

URGENCY CHECK: If the title or content contains any of these keywords: عاجل, مرسوم, قرار رئاسي, انفجار, عقوبات, زلزال, توغل, قصف, غارة, غارات, اشتباك, اشتباكات, اغتيال, استهداف, أمني, أمنية, عسكري, صاروخ, صواريخ, مسيرة, مسيرات, breaking, خبر عاجل
Then mark "isUrgent": true. Urgent news always gets selected regardless of score.

Selection Threshold: Only items with a score >= {editor_config.get('scoring_threshold', 7.0)} should be selected (unless urgent).
BE GENEROUS with scoring during growth phase — we need volume. If it's remotely interesting to Syrians, lean towards selecting it.
"""

    prompt = f"Please score the following raw news feed and identify the best items for publication.\n\nRaw News Feed (JSON):\n{json.dumps(raw_items, ensure_ascii=False)}"

    config = LocalAgentConfig(
        model="gemini-2.0-flash",
        response_schema=ScoringSchema,
    )
    
    async with Agent(config) as agent:
        response = await agent.chat(system_instruction + "\n\n" + prompt)
        data_out = await response.structured_output()
        
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data_out.get("items", []) if data_out else [], f, ensure_ascii=False, indent=2)


async def copywrite(input_path: str, output_path: str):
    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    selected_item = data.get("selectedItem", {})
    brand_config = data.get("brandConfig", {})
    copywriting_guidelines = data.get("copywritingGuidelines", "")
    
    system_instruction = f"""You are the Lead Copywriter for {brand_config.get('brand', {}).get('name_arabic', '')}.

Follow these strict copywriting guidelines:
{copywriting_guidelines}

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
- If the news is about a specific person, a specific event, a specific object, or anything specific whose visual context or resemblance is important and we have an image URL from the scraped news (Original Image URL is not 'No image available'), you MUST set "imageStrategy": "reference" to use that image as a reference.
  * If you set "imageStrategy": "reference", the "imagePrompt" MUST NOT describe the news article details or write a new custom scene. Instead, you MUST write a prompt to recreate the reference image, formatted exactly as: "A high-quality, realistic photo of [main topic], recreating the reference image from a DIFFERENT ANGLE (to avoid copyright), REMOVE ALL WATERMARKS AND TEXT, keep EXACTLY THE SAME DETAILS AND SUBJECTS, extremely high quality."
  * If you want to depict a different, more general or illustrative scene that does not match the reference image, you MUST set "imageStrategy": "generate" to ignore the reference image.
- Only set "imageStrategy": "generate" (text-only prompt) if the news is about a very general/abstract topic, if there is no image URL in the news source, or if the original image is irrelevant/mismatched to the scene you want to depict.
- For BOTH strategies, write a photorealistic prompt in English describing what the image should look like.
- AI IMAGE SAFETY & SYMBOLISM RULES (CRITICAL):
  * Do NOT inject or add flags, logos, emblems, maps, or other political/national symbols into the prompt unless they are explicitly mentioned/requested in the news text. Most real-world scenes do not have flags or official emblems. Keep the scene realistic and clutter-free.
  * If (and ONLY if) a Syrian flag is explicitly requested or central to the news context, you MUST write "the Syrian Revolution flag with green, white, and black horizontal stripes and three red stars in the middle". NEVER write "Syrian flag" without this description.
  * NEVER use generic terms like "Syrian president", "Syrian diplomat", or "Syrian leader" WITHOUT explicitly naming the person, as the AI will default to generating Bashar Al-Assad. If the news is about a specific person, you MUST name them explicitly in the prompt AND you MUST set "imageStrategy": "reference" if an Original Image URL is provided.
- Do NOT be vague. If the news is about "Morocco vs Scotland", explicitly say "Morocco flag and Scotland flag" or "Morocco football players playing against Scotland football players in stadium".
- DO NOT hallucinate details that conflict with the news.
- The image MUST look realistic, cinematic, and NOT like generic AI slop. It MUST resemble the Syrian or Arab context where applicable.

CRITICAL CAPTION & HASHTAG RULE (DUAL OUTPUT):
You MUST generate TWO distinct captions:
1. "socialMediaCaptionLong": For Facebook and Instagram. This must be highly intriguing, fun to read, detailed, and structured to capture attention and maximize dwell time. End with a strong hook or question for engagement. You MUST use a newline character '\\n' to separate the main text from the hashtags. Include the mandatory hashtags "{' '.join(brand_config.get('brand', {}).get('hashtags', []))}" PLUS up to 20 additional highly targeted, trending hashtags to maximize SEO and Instagram Reels exposure (mix broad terms like #سوريا with niche and viral terms).
2. "socialMediaCaptionShort": For X (Twitter). This must be extremely concise, straight to the point, and strictly under 240 characters total. Use a newline '\\n' before hashtags. Include the mandatory hashtags "{' '.join(brand_config.get('brand', {}).get('hashtags', []))}" PLUS only 1 or 2 extra highly relevant hashtags.
"""

    prompt = f"""Rewrite the following article details:
Title: {selected_item.get('title', '')}
Content: {selected_item.get('description', '') or selected_item.get('content', '')}
Original Image URL: {selected_item.get('imageUrl', 'No image available')}
Is Urgent / Breaking News (Phase 1 Flag): {'Yes' if selected_item.get('isUrgent') else 'No'}

CRITICAL Content-Type Selection Rule:
- You MUST set "contentType" to "urgent" if "Is Urgent / Breaking News" is "Yes", or if the Title or Content contains "عاجل" or represents security/military alerts or high-priority breaking news.
- You MUST set "contentType" to "white" if the news consists of tables, listings, weather, currency, gold, or daily utility.
- You MUST set "contentType" to "black" if the news is an opinion, deep analysis, column, or profile of a person/public figure.
- Otherwise, set "contentType" to "green" for general news.
"""

    config = LocalAgentConfig(
        model="gemini-2.0-flash",
        response_schema=CopywritingSchema,
    )
    
    async with Agent(config) as agent:
        response = await agent.chat(system_instruction + "\n\n" + prompt)
        data_out = await response.structured_output()

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data_out, f, ensure_ascii=False, indent=2)


async def refine_copywrite(input_path: str, output_path: str):
    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    selected_item = data.get("selectedItem", {})
    previous_payload = data.get("previousPayload", {})
    feedback = data.get("feedback", "")
    brand_config = data.get("brandConfig", {})
    copywriting_guidelines = data.get("copywritingGuidelines", "")
    
    system_instruction = f"""You are the Lead Copywriter for {brand_config.get('brand', {}).get('name_arabic', '')}.

Follow these strict copywriting guidelines:
{copywriting_guidelines}

We have already generated a post payload, but the Admin requested changes to the content, headline, or caption.
Your task is to refine the previous copywriting payload based on the Admin's feedback.

Previous Copywriting Payload:
{json.dumps(previous_payload, ensure_ascii=False, indent=2)}

Admin Feedback/Modification Request:
"{feedback}"

Ensure you ONLY change the text or styling as requested by the feedback. Keep all other fields, image prompts, image strategy, and structures intact unless specifically requested to change them.
CRITICAL HEADLINE CONSTRAINT:
- If you rewrite the headline, it MUST adhere strictly to the word limits:
  * For T1: 4-5 words max (single line: line1).
  * For T2: 10-12 words max in total combined across line1 and line2.
  * If the headline has trailing dots, or was cut off, you MUST rewrite it to be shorter and cleaner while keeping the news value.
"""

    prompt = f"""Please apply the admin feedback to refine the payload.
Feedback: "{feedback}"

Original Article Context:
Title: {selected_item.get('title', '')}
Content: {selected_item.get('description', '') or selected_item.get('content', '')}
Is Urgent / Breaking News (Phase 1 Flag): {'Yes' if selected_item.get('isUrgent') else 'No'}

CRITICAL Content-Type Selection Rule:
- You MUST set "contentType" to "urgent" if "Is Urgent / Breaking News" is "Yes", or if the Title or Content contains "عاجل" or represents security/military alerts or high-priority breaking news.
- You MUST set "contentType" to "white" if the news consists of tables, listings, weather, currency, gold, or daily utility.
- You MUST set "contentType" to "black" if the news is an opinion, deep analysis, column, or profile of a person/public figure.
- Otherwise, set "contentType" to "green" for general news.
"""

    config = LocalAgentConfig(
        model="gemini-2.0-flash",
        response_schema=CopywritingSchema,
    )
    
    async with Agent(config) as agent:
        response = await agent.chat(system_instruction + "\n\n" + prompt)
        data_out = await response.structured_output()

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data_out, f, ensure_ascii=False, indent=2)


async def refine_image(input_path: str, output_path: str):
    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    previous_payload = data.get("previousPayload", {})
    feedback = data.get("feedback", "")
    
    previous_prompt = previous_payload.get("imagePrompt", "")
    if not previous_prompt and previous_payload.get("slides") and len(previous_payload.get("slides")) > 0:
        previous_prompt = previous_payload.get("slides")[0].get("imagePrompt", "")
        
    sub_headline = previous_payload.get("subHeadline", "")
    headline_obj = previous_payload.get("headline") or {}
    headline_text = f"{headline_obj.get('line1', '')} {headline_obj.get('line2', '')}".strip()
    points_list = previous_payload.get("points", [])
    points_text = "\n".join(points_list) if isinstance(points_list, list) else ""

    prompt = f"""You are a strict and highly intelligent creative director. We need a new English image prompt for an AI image generator based on user feedback.

=== News Context ===
Category/Topic: {sub_headline}
Headline: {headline_text}
Key Points:
{points_text}

=== Previous Prompt ===
"{previous_prompt}"

=== User Modification Feedback ===
"{feedback}"

=== Instructions ===
The user was not satisfied with the previous prompt and provided specific feedback. You must generate a COMPLETELY NEW English image prompt that perfectly fulfills their request.

CRITICAL RULES:
1. STRICT ADHERENCE: Do NOT simply mix or blend the user's feedback with the old prompt in a messy way. Read what they want, understand what they didn't like, and write a perfect, cohesive new prompt from scratch.
2. REFERENCE IMAGE RULES: If the user mentions a reference image or the news uses a specific image reference strategy, you MUST include instructions to:
   - Use a slightly different camera angle (do NOT match the angle perfectly, to avoid copyright).
   - Keep the exact same core details and subjects.
   - Be extremely high quality and photorealistic.
   - Strictly NO watermarks, logos, or text on the image.
3. NO HALLUCINATION: Do not hallucinate random objects, flags, or elements that the user did not ask for. Keep it clean and focused.
4. SYRIAN CONTEXT SAFETY:
   - If a Syrian flag is explicitly requested, it must be exactly "the Syrian Revolution flag with green, white, and black horizontal stripes and three red stars in the middle".
   - Never use "Syrian president" or "Syrian leader" without explicitly naming them.
5. NO APOLOGIES: Output ONLY the final image prompt in English. No introductory text, no quotes around the prompt, just the raw prompt.
"""
    
    config = LocalAgentConfig(
        model="gemini-2.0-flash",
        response_schema=ImagePromptSchema,
    )
    
    async with Agent(config) as agent:
        response = await agent.chat(prompt)
        data_out = await response.structured_output()

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data_out, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    command = sys.argv[1]
    input_file = sys.argv[2]
    output_file = sys.argv[3]
    
    if command == "score":
        asyncio.run(score_feed(input_file, output_file))
    elif command == "copywrite":
        asyncio.run(copywrite(input_file, output_file))
    elif command == "refine_copywrite":
        asyncio.run(refine_copywrite(input_file, output_file))
    elif command == "refine_image":
        asyncio.run(refine_image(input_file, output_file))
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)
