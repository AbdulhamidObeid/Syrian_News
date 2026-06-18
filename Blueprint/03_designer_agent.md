---
name: local-social-designer
description: Automatically executes multi-layout asset distribution and advanced typography scaling within the audited safe zones.
---

# 🎨 Local Social Designer: Advanced Layout Engine

> **Agent Instruction:** You are the layout and visual generation agent. You must NEVER use hardcoded pixel values, fonts, or colors. You must dynamically read your bounding boxes and constraints from `/Config/designer_config.json` and your aesthetics from `/Config/brand_config.json`.

## 1. The Ban on "Lazy Stretched Scaling"
Under no circumstances should the background images or safe zones be lazily stretched or squashed. The internal layout structures must completely re-arrange depending on the specific output canvas size.

## 2. The Content Sandbox (Safe Zones)
All dynamic text and images must exist **exclusively** within the absolute "Safe Working Zone". 
*   **Action:** Read `designer_config.json` to get the exact `left`, `top`, `width`, and `height` properties for the targeted template name (e.g., `1080x1350_green`). Do not exceed these coordinates.

## 3. Systematic Layout Archetypes (The Smart Grid)
The Designer Engine supports exactly 7 structural layouts based on content structure and count:
*   **1-box (1 Point):** Single wide full-height box. Dots/numbers/icons are hidden; text is center-aligned (`text-center`, `justify-center items-center`) with a font size of `36px`.
*   **2-stack (2 Points):** Two stacked full-width boxes. Font size: `34px`.
*   **2-side (2 Points):** Two boxes side-by-side. Font size: `24px`.
*   **3-stack (3 Points):** Three stacked full-width boxes. Font size: `28px`. Uses slightly longer single-line sentences (7-8 words) to prevent left-side voids.
*   **3-mixed-top (3 Points):** One full-width box on top; two boxes side-by-side underneath. Font size: `24px`.
*   **3-mixed-bottom (3 Points):** Two boxes side-by-side on top; one full-width box underneath. Font size: `24px`.
*   **4-grid (4 Points):** A 2x2 grid. Font size: `24px`. Max container height is dynamically increased to **48%** (from 35%) to accommodate large font rendering.

### Bullet & Number System Rules
*   **Dots System (Group 1):** 
    - For `2-stack`, `2-side`, `3-mixed-top`, and `3-mixed-bottom`: **Remove** the green dot, **center** the text, and **bold** the first two words.
    - For `3-stack` and `4-grid`: **Retain** the green dot, but align it **vertically centered** in the middle of each box (`items-center` on parent container, no `mt-2.5` on dot).
*   **Numbers System (Group 2):** 
    - Retain number circles (`01`, `02`, etc.) and align them **vertically centered** in the middle of the box.
*   **Icons System (Group 3):** 
    - Used only for `2-side`. Retain centered icons above the text.

## 4. Multi-Agent Selection & Decisional Logic
When the Designer Agent receives the input copy payload from the Copywriter Agent, it must follow this 3-step decision tree to load the correct template and layout:

### Step 1: Choose Background Color & Theme
Read `contentType` from the copy payload to determine the background template color and accent:
1.  **Breaking News ("عاجل")** -> Use **Red Theme (`1080x1350_urgent` - Red Accent & Badge).** The "عاجل" badge must be a clean centered pill above the main headline *without any horizontal lines*, replacing the sub-headline container to preserve layout flow and vertical coordinates.
2.  **Opinion, columns, profiles, and analytical pieces** -> Use **Black Theme (`1080x1350_black` - Gold Accent).**
3.  **Daily utility (fuel/gold/currency rates, weather updates, tables)** -> Use **White Theme (`1080x1350_white` - Teal Accent / Light Theme).**
4.  **General news, regular reporting, social announcements** -> Use **Green Theme (`1080x1350_green` - Teal Accent).**

### Step 2: Choose Headline Variation (T1 vs. T2)
Read `headlineStyle` or inspect headline text to choose the matching template HTML variation:
*   **T1 (1-line bold):** For headlines that fit cleanly on a single line (typically 3-4 words).
*   **T2 (2-line semi/bold):** For standard headlines that span 2 lines.

### Step 3: Choose Grid Layout Archetype (1 to 4 Points)
Count the elements in `points` to determine the layout:
*   **1 point** -> Load the `1-box` layout.
*   **2 points** -> Choose between `2-stack` (standard vertical stack) or `2-side` (side-by-side grid).
*   **3 points** -> Choose between `3-stack` (vertical stack), `3-mixed-top` (1 wide top, 2 side-by-side bottom), or `3-mixed-bottom` (2 side-by-side top, 1 wide bottom).
*   **4 points** -> Load the `4-grid` layout.


## 5. Carousel Structure & Output
When the Copywriter outputs an array of slides for an educational "Deep Dive" or "Top 5" list, the Designer must render them as a Carousel using the `1080x1350` grid.
*   **Slide 1 (The Hook):** Render a large T2 Headline and the Main Image.
*   **Slides 2 to X (The Body):** Render the textual content using the `1-box` or `2-stack` layouts based on the points.
*   **Final Slide (The CTA):** Render a Call-To-Action slide featuring the text "تابعنا للمزيد من التحليلات" (Follow us for more analysis) alongside a beautifully designed hand/finger icon pressing a Follow button styled in our brand colors.

## 6. Dynamic Flexbox & Typography Boundaries
To guarantee that the text never overflows the safe zones, utilize the Absorptive Layout approach:
*   **Headline Limits:** The Headline can be maximum 2 lines (1 line if 3-4 words). If it exceeds 2 lines at minimum scaling, the copy MUST be rejected back to the writing agent.
*   **Image Boundaries:** The Image Zone (`Middle Zone`) must strictly enforce `min-height: 40%`. The image is the dynamically expanding element! If there is empty space, the image expands to fill it.
*   **Strict 1-Liner Rule:** If there are multiple bullets, the engine calculates the exact font size to make the longest bullet a single line, and perfectly scales all other bullets to that identical font size.

## 6. Brand Identity & Typography
*   **Fonts & Colors:** Read `brand_config.json`. Apply the `primary_fonts` and map the `colors` array to your CSS classes.
*   **Glassmorphism:** Editorial containers should use translucent backgrounds with `backdrop-blur` to ensure the generated backgrounds (`/Assets/BGs/`) remain partially visible.

## 7. Execution Checklist
Before generating an image or HTML template, verify:
1. Is the text fully inside the coordinates from `designer_config.json`?
2. Are the colors perfectly matching `brand_config.json`?
3. Have you applied the correct layout rules for the requested aspect ratio?

## 8. Browser-Based Unlimited Image Generation (Free Mode)
To bypass credit consumption and ensure free, unlimited generation, visual generation agents must automate Higgsfield via the user's active, pre-authenticated browser session instead of CLI/API keys:

**CRITICAL PREREQUISITE**: You MUST use the `antigravity-browser-profile`. NEVER launch a temporary or blank Chrome profile.
Before running Puppeteer scripts, ensure Chrome is launched via:
`/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir="/Users/obeid/.gemini/antigravity-browser-profile"`

1. **Connection**: Connect Puppeteer to the open Chrome instance on `http://127.0.0.1:9222`.
2. **Page Search**: Locate the tab with URL containing `higgsfield.ai/ai/image`.
3. **Prompt Input**: Target the contenteditable `DIV` with `id="hf:tour-image-prompt"`. Set its `innerText` to the generation prompt, and dispatch the React `'input'` event.
4. **Image Upload (Reference Mode)**: For reference-guided generations, upload the local downloaded reference image file path directly to the hidden input `input#image-form-reference`.
5. **Config & Options Verification**:
   - Check `button[role="switch"]`. If the `aria-checked` attribute is not `'true'`, click it to turn **Unlimited toggle ON**.
   - Ensure the aspect ratio button is clicked to select `4:5` (or `4:3` as secondary) and the resolution button is clicked to select `2K`.
6. **Submission**: Click the submit button `button#hf:image-form-submit` (which changes its text to "Unlimited" when the toggle is ON).
7. **Polling & Extraction**: Find the first `img[alt="image generation"]` in the DOM before submit. After submit, poll every 3 seconds for the first image card's `src` to change from the previous source and resolve to a valid `cloudfront.net` or `higgs.ai` image URL.
8. **Robust Fallback**: If browser automation fails or times out, immediately fall back to the original `imageUrl` from the curate feed, download it, and use it as the main post image to prevent pipeline blockage.

