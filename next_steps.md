# Automated Newsroom (HashSYR24) - Project Handoff & Next Steps

Welcome! This document provides a comprehensive overview of the workspace structure, design system, template logic, and the remaining execution roadmap. Review it carefully before writing any new code or agents to prevent hallucinations.

---

## 1. Directory Structure Reference
Here is the layout of the project workspace:
```text
Syrian_News/
├── Blueprint/               # Numbered Agent blueprints (system instructions)
│   ├── 01_business_blueprint.md
│   ├── 02_editor_copywriter_agent.md
│   ├── 03_designer_agent.md
│   ├── 04_publisher_agent.md
│   ├── 05_video_creator_agent.md
│   ├── 06_diverse_content_workflow.md
│   ├── 07_template_automation_workflow.md
│   └── 08_project_onboarding_questionnaire.md
├── Platform_Playbooks/      # Rules and aspect ratios per platform
│   ├── facebook_instagram_playbook.md
│   └── x_tiktok_playbook.md
├── Config/                  # Master JSON configuration files
│   ├── brand_config.json    # Fonts, colors, voice, and restrictions
│   ├── designer_config.json # Bounding boxes for Safe Zones (1080x1350)
│   └── kpi_targets.json     # Publishing metric targets
├── Assets/                  # Visual and typographic assets
│   ├── BGs/                 # Background JPG files
│   ├── Brand_Assets/        # Logos and visual brand graphics
│   ├── Resources/           # SVGs, icons, and layout maps (moved here)
│   ├── Templates/           # Raw Illustrator template templates
│   └── fonts/               # IBM Plex Sans Arabic TTF files (Thin to Bold)
├── Agent_Scripts/           # Automation scripts
│   ├── Designer_Engine/     # Dynamic image generation logic
│   │   ├── templates/       # Precompiled HTML templates
│   │   │   ├── 1080x1350_black.html
│   │   │   ├── 1080x1350_green.html
│   │   │   ├── 1080x1350_urgent.html
│   │   │   └── 1080x1350_white.html
│   │   ├── catalog_output/  # Pre-rendered matrix of 112 layouts
│   │   ├── generate_templates.js # Recompiles templates/
│   │   ├── generate_catalog.js   # Generates all 112 catalog PNG files
│   │   ├── test_all.js      # Verifies coordinates and font sizing
│   │   └── sample.jpg       # Test image
│   ├── Publisher_Engine/    # Headless publishing
│   │   └── poster.js        # Puppeteer script for X, FB, IG, and TikTok
│   └── Guides/              # Technical rules
│       └── Template_Creation_Rules.md
└── next_steps.md            # THIS FILE (Root handoff)
```

---

## 2. The Unified Aspect Ratio Rule
*   **Dimension:** Every single output image must be exactly **`1080x1350`** (Portrait).
*   **TikTok / Reels exception:** TikTok does **not** use `1080x1920`. It uses the `1080x1350` slide images, which are programmatically converted into a `1080x1350` MP4 video using ffmpeg (`poster.js` handles this via the `-vf scale=1080:1350` filter) before posting.
*   **Config coordinates:** Bounding box coordinates for the safe zone are mapped in `Config/designer_config.json` under `1080x1350_*` keys.

---

## 3. Decisional Matrix for the Agents

### A. Copywriter/Editor Agent Decisional Flow
When receiving a raw news update, the copywriting agent must structure it into a JSON payload with:
1.  **`contentType` (Color Selection):**
    *   `urgent` (Red): Breaking news ("عاجل").
    *   `black` (Black): Opinion pieces, columns, deep analytical essays.
    *   `white` (White): Daily utilities (exchange rates, gold prices, weather tables).
    *   `green` (Green): Standard news reports and announcements.
2.  **`headlineStyle` (Title Selection):**
    *   `T1` (1-line): Short headline (3-4 words max, completely bold).
    *   `T2` (2-line): Standard headline (Line 1: Semi-bold context, Line 2: Bold news text).
3.  **`points` (Layout Archetype):**
    *   1 point $\rightarrow$ Loads `1-box` layout (clean centered paragraph, no dots).
    *   2 points $\rightarrow$ Loads `2-stack` (vertical stack) or `2-side` (side-by-side).
    *   3 points $\rightarrow$ Loads `3-stack` (vertical) or `3-mixed` layout.
        *   *Constraint:* For `3-stack`, keep bullets to **7-8 words maximum** (must fit on a single line) to prevent empty space on the left side.
    *   4 points $\rightarrow$ Loads `4-grid` layout.

### B. Designer Agent Decisional Flow
The designer agent reads the payload, matches it to the correct color template + title variation, inserts the dynamic text, scales font sizes programmatically using the validation library, captures a Puppeteer screenshot, and outputs the final PNG file.

---

## 4. Prioritized Execution Roadmap (What is Next)

### 🔴 Priority 1: Editor & Copywriting Orchestrator (`curator.js`)
*   **Path:** Create `Agent_Scripts/Editor_Engine/curator.js`
*   **Tasks:**
    *   Set up a Node.js script that connects to the Gemini API.
    *   Feed the copywriting guidelines from `Blueprint/02_editor_copywriter_agent.md` as system instructions.
    *   Enforce structured outputs so it returns the exact Copy Payload JSON schema.

### 🟡 Priority 2: Dynamic Post Generator (`generate_post.js`)
*   **Path:** Create `Agent_Scripts/Designer_Engine/generate_post.js`
*   **Tasks:**
    *   Develop a Node.js script that takes the Copy Payload JSON, reads the matching template from `Agent_Scripts/Designer_Engine/templates/`, dynamically builds the HTML with target grid divs, and screenshots it at `1080x1350`.

### 🟢 Priority 3: Ingestion Scraper (`scraper.js`)
*   **Path:** Create `Agent_Scripts/Scout_Engine/scraper.js`
*   **Tasks:**
    *   Automate scraping of gold, fuel, exchange rates, and news RSS feeds.
    *   Output scraped raw data into a local `feed.json` file for the curator.

### 🔵 Priority 4: Full Multi-Agent Pipeline Runner (`run_pipeline.js`)
*   **Path:** Create `run_pipeline.js` in root
*   **Tasks:**
    *   Write a master loop that orchestrates the scraper, the LLM curator, the HTML designer renderer, and the publisher (`poster.js`) end-to-end.

### 🟣 Priority 5: Remotion React Video Project
*   **Path:** Initialize inside `Agent_Scripts/Video_Engine/`
*   **Tasks:**
    *   Link motion assets (Lottie JSON files) with dynamic Remotion text overrides to produce professional broadcast video alerts.
