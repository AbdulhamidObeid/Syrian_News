# Syrian Visual Identity: Comprehensive Brand Guidelines

## Official Brand Name
**English:** HashSYR24  
**Arabic:** هاشتاق سوريا

---

## 1. Official 9-Color System (لوحة الألوان)
This is the strict 9-color brand identity system. Do not use pure black (`#000000`).

| **Neutrals (المحايدة)** | **Primary Greens (الأخضر الأساسي)** | **Accents (الألوان الثانوية)** |
| :--- | :--- | :--- |
| **Pure White:** `#FFFFFF`<br>**Light Gray:** `#BFB4B7`<br>**Dark Gray:** `#3E3A3B`<br>**Off-Black:** `#161616` | **Deep Pine:** `#002D29`<br>**Teal:** `#56A596` | **Gold:** `#DBBE8F`<br>**Crimson:** `#C93D57`<br>**Maroon:** `#4A151E` |

---

## 2. Typography & Tech Minimalist Layout Rules
- **Official Font:** `IBM Plex Sans Arabic`
- **Line Height:** Arabic text requires a larger line height (`1.6` or `1.7` globally, or `leading-relaxed` in Tailwind).
- **Dual-Weight Split (Headlines):** 
  - Sub-Headline: Medium weight (500), slightly smaller.
  - Main Headline: Bold weight (700), larger font size.
- **Body Content:** Regular weight (400) for long sentences.
- **Spacing:** Use an 8-point grid system (8px, 16px, 24px, 32px, 48px).

---

## 3. Voice & Tone (شخصية العلامة التجارية)
**The Objective Guardian (الحارس الموضوعي)**
*   **Authoritative but Unbiased:** Present facts clearly and accurately. No clickbait, emotional manipulation, or exaggeration.
*   **Clear and Concise:** Respect the audience's time. Keep headlines under 12 words where possible. 
*   **Modern Standard Arabic (الفصحى المعاصرة):** Use formal, serious tone for news, but a simpler, interactive tone for community/cultural stories.
*   **Dates:** Always use standard global months (يناير، فبراير) instead of Syriac months. Example: `09 يونيو 2026`.

---

## 4. The HTML/Puppeteer Headless Engine
All templates are driven by a headless programmatic workflow located in `/engine/`.

*   **HTML Structure:** The master template (`engine/generate_templates.js`) dynamically builds standard social media posts.
*   **Safe Zones:** Templates restrict text dynamically using a `flex-col` safe zone. The JavaScript algorithm calculates layout bounds and dynamically resizes text so that glass panels never overlap with footer logos.
*   **Glassmorphism:** Rendered using translucent `background-color` with `backdrop-blur-[40px]` over the background `.jpg` files located in `Creatives/Designs/BGs/`.

---

## 5. Official Assets & Logos
All raw `.png`, `.json`, and `.html` brand artifacts are located in the `Strategy/Brand_Assets/` directory.

- The Syrian Flag colors and GeoJSON Map are strictly defined and stored internally.
- Use the official Gold (`#DBBE8F`) for heritage/official accents.
