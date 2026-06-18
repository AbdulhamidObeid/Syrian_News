# Syrian News (HashSYR24) - Automated Media Empire Architecture

This document provides a comprehensive, deep-dive explanation of the **Syrian News (HashSYR24)** project. It details the file structure, the pipeline, the design system, and the exact step-by-step workings of each AI agent so that a new AI agent can understand the entire ecosystem from scratch.

---

## 1. Executive Summary, Vision & Modularity

### The Ultimate Goal: Monetization & Audience Dominance
The primary objective of this project is to build an automated, massive media empire that garners **millions of active followers**. By achieving a huge active following, the brand will unlock high-tier monetization opportunities. This includes native advertising, sponsored deep-dives, and brands reaching out directly to place ads on our channels, resulting in significant revenue streams. 

### Modularity & The HashSYR24 Test
It is critical to understand that **this is a modular, brand-agnostic automation project**. Currently, it is being applied to the `HashSYR24` brand purely to test the system. However, the modularity is not yet applied perfectly and needs to be fixed by the upcoming agent. 

**The Rule of Decoupling:** Agents should *never* have brand-specific information or browser profile names hardcoded inside their scripts. All brand data, styling, targeting, and system parameters (including the browser profile to use) must be stored in the `JSON` configuration files. Each agent must read its specific JSON file to dynamically load the context and parameters for whichever brand it is currently operating.

---

## 2. Directory Structure & Ecosystem

The project is structured into specialized folders, each handling a distinct part of the architecture:

*   **`Agent_Scripts/`**: Contains the code for all the execution engines.
    *   **`Scout_Engine/`**: Responsible for data extraction (`scout.js`).
    *   **`Editor_Engine/`**: Responsible for scoring and copywriting (`curator.js`).
    *   **`Designer_Engine/`**: Responsible for visual generation, templates, and dynamic rendering (`generate_post.js`).
    *   **`Publisher_Engine/`**: Responsible for API and headless cross-platform publishing (`poster.js`).
    *   **`Telegram_Engine/`**: Responsible for human-in-the-loop QA and broadcasting (`telegram_admin.js`).
*   **`Blueprint/`**: Contains the strategic markdown files that define the rules, limits, and behavior of each agent.
*   **`Config/`**: Contains the JSON configuration files representing the single source of truth for brand identity, scheduling, safe zones, KPIs, and news sources.
*   **`Assets/`**: Stores background assets and visual templates.
*   **`Dashboard/`**: Contains the UI elements and design systems to visualize the project's performance.
*   **`run_pipeline.js`**: The Master Orchestrator Agent sitting at the root.

---

## 3. Brand Identity & Visual System (JSON Driven)

Read from `/Config/brand_config.json` and `/Config/designer_config.json`.

*   **Name**: HashSYR24 (هاشتاق سوريا)
*   **Tone of Voice**: "The Objective Guardian" (Authoritative, Clear, Modern Standard Arabic).
*   **Typography**: IBM Plex Sans Arabic (Base text), Cairo (Video/Motion).
*   **The 4 Color Themes**:
    1.  **Green (`1080x1350_green`)**: Default for general news, social announcements.
    2.  **White (`1080x1350_white`)**: Daily utility (weather, gold, fuel rates).
    3.  **Black (`1080x1350_black`)**: Opinion pieces, analytical deep-dives, columns.
    4.  **Red (`1080x1350_urgent`)**: High-priority breaking news ("عاجل").

---

## 4. The Master Orchestrator Agent (`run_pipeline.js`)

The pipeline runs on a scheduled interval (e.g., every 60 minutes) or continuously. The Master Agent in `run_pipeline.js` acts as the overarching controller of all other agents. 

It dictates exactly when each agent should run, ensures every step is completed correctly before passing data to the next phase, and handles error catching. If a failure occurs in any of the sub-agents (e.g., Designer fails to generate, Publisher API breaks), the Master Agent immediately sends a notification/alert to the Telegram admin.

---

## 5. Deep Dive into the Sub-Agents

### A. The Scout Agent (`scout.js`)
*   **Mandate**: Extract structured data from approved sources without hardcoding.
*   **Logic**: Reads `/Config/sources_config.json` to find RSS feeds grouped by categories.
*   **Anti-Duplication**: Maintains a `feed_history.json` array to ensure an article is never fetched twice.

### B. The Editor/Curator Agent (`curator.js`)
*   **Mandate**: The intellectual core. It filters noise, rewrites news, and dictates the entire visual flow.
*   **Phase 1 (Scoring)**: Evaluates raw feed items from 1 to 10 based on relevance and impact.
*   **Phase 2 (Smart Decision Making & Copywriting)**:
    1.  **Carousel vs. Single Post**: The Curator must be smart enough to determine the subject's depth from the beginning. It analyzes the news and decides if it warrants an exciting, informative multi-slide Carousel, or if a single post is sufficient. This decision fundamentally dictates how the Designer and Publisher will behave downstream.
    2.  **Layout Choice**: Strictly depends on the amount of information extracted. The layout must map directly to the number of bullet points generated: 1, 2, 3, or 4 points.
    3.  **Image Strategy**: 
        *   *Option 1 (Reference)*: If the news is about a specific person, a specific real-world place, or something that cannot be generalized, it fetches the exact scraped image and passes it to Higgsfield as a reference. The goal is to regenerate the same image in high quality, remove any watermarks, and slightly change the camera angle to avoid copyright strikes.
        *   *Option 2 (Prompt Generation)*: If the news is general, it writes an exclusive, highly specific prompt. The generated image must be realistic, highly meaningful, resemble the Syrian context, and definitely *not* look like nonsensical AI slop.
    4.  **Smart Captions**: Generates a caption that strictly respects the character limits of the target platforms. The text must include highly relevant keywords to the topic, and it **MUST ALWAYS** conclude with the hashtags `#هاشتاق_سوريا` and `#HashSYR24`.

### C. The Designer Agent (`generate_post.js`)
*   **Mandate**: Turn the JSON copy payload into stunning graphics based on the Curator's decisions.
*   **Carousel vs. Single Rules**: At the very beginning of its run, the Designer checks the payload to see if it is building a Carousel or a Single Post. It uses entirely different templates and specific rules for Carousels (e.g., Hook slide, Body slides, CTA slide) and must not mix them up with Single Post logic.
*   **Image Generation Engine**: Uses Puppeteer to automate Higgsfield. 
    *   *Crucial Profile Rule:* It uses a specific Chrome profile (e.g., `antigravity-browser-profile`), but this profile name must NOT be hardcoded. It should be dynamically read from the JSON config files fed to the designer.
*   **Dynamic Scaling**: Employs an Absorptive Layout algorithm to iteratively reduce font sizes to prevent text from overflowing the strict boundaries defined in the configs.

### D. The Telegram Engine (`telegram_admin.js`)
*   **Mandate**: Act as the bridge between the autonomous pipeline and the human operator for Quality Assurance.
*   **Workflow**: Presents the final graphic and caption to the admin with four specific inline buttons:
    *   **[✅ Approve]**: Confirms the post is perfect and triggers the Publisher Agent.
    *   **[❌ Reject]**: Discards the post entirely and deletes the assets.
    *   **[✏️ Modify]**: Allows the admin to send back feedback to adjust the copy or image before regenerating.
    *   **[🔄 Retry Post]**: Commands the pipeline to attempt generation again if there was a glitch, timeout, or visual error.

### E. The Publisher Agent (`poster.js`)
*   **Mandate**: Publish the final assets (Single image or Carousel series) flawlessly to the target platforms.
*   **Carousel vs Single Awareness**: The Publisher understands the payload structure and dynamically adjusts its behavior to upload either a single image or sequentially upload a series of images if it detects a Carousel.
*   **The Primary Strategy (APIs)**: The system MUST prioritize publishing via official/approved APIs defined in the project files:
    *   **Facebook & Instagram**: Uses the official Facebook Graph API.
    *   **X (Twitter)**: Uses the Buffer API.
    *   **TikTok**: Uses the Zernio API.
*   **The Fallback Strategy (Web-Bot)**: Only if the APIs fail or rate-limit the system, the Publisher will fallback to a headless Puppeteer web-bot. This bot uses the exact same Chrome profile defined in the JSON (the one used for Higgsfield) to natively navigate the platforms and post. However, this fallback method is known to be laggy, creates issues, and breaks frequently, so it is strictly a Plan B.

---

## 6. Dashboard, KPIs & Adaptation

To ensure the ultimate goal of monetization and millions of followers is reached, the system relies on strict KPI tracking (defined in `Config/kpi_targets.json`).

*   **Metrics**: Tracks baseline metrics (Minimum Doable KPIs to prove the system works) versus aggressive "Dreamer KPIs" required for monetization.
*   **Review & Adaptation**: The project features an evaluation loop. If reach or engagement drops by >30% over a specified period, the system is designed to alert the operators to pivot the strategy, pause high-frequency automation, and adjust the master HTML templates to re-align with algorithmic preferences. The Dashboard folder holds the UI structures to visualize this growth.

---

*This document represents the absolute state and truth of the HashSYR24 architecture. New agents should refer back to this flow to understand where their modifications fit within the grand pipeline, always ensuring modularity, decoupled JSON data, and adherence to the API-first publishing structure.*
