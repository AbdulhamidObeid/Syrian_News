# 🚀 Project Onboarding & Setup Questionnaire

> **Agent Instruction (Setup Architect):** You must heavily utilize your brainstorming and planning skills to have a deep discussion with the user. Do not execute or create any configurations until you are 100% satisfied that every variable below is perfectly captured. This avoids modifications down the line.

## Phase 1: Brand Foundations
1. **Brand Name:** What is the official name of the project? (e.g., CookingDaily, HealthHacks)
2. **Niche & Mission:** What is the core subject matter, and what value does it provide to the audience?
3. **Target Audience:** Who are we trying to reach? (Demographics, location, interests).
4. **Tone of Voice:** If this brand were a person, how would they sound? (e.g., Casual & friendly, authoritative & objective, hyper-energetic).

## Phase 2: Visual Identity (Brand Config)
5. **Primary Fonts:** What are the 1 or 2 official fonts for this project? (Provide Google Font names if possible).
6. **The Color System:** Please provide the exact HEX codes for:
   - Primary Background Colors (e.g., Deep Pine, Navy Blue)
   - Accent Colors (e.g., Gold, Neon Pink)
   - Neutral Colors (e.g., Off-White, Dark Gray)

## Phase 3: Layout & Safe Zones (Designer Config)
7. **Aspect Ratios:** Which aspect ratios will we support? (Typically 1080x1350 for FB/IG/X, and 1080x1920 for Reels).
8. **The Safe Zone Calculation:** 
   *Note: The user will not calculate this manually. You (the Architect) will generate an `.ai` file with a "Design" layer and a "Safe Zone" layer. The user will draw a white box in the Safe Zone layer, and you will read the coordinates to fill the `designer_config.json` automatically.*
9. **Typography Constraints:** Are there any strict limits on how many lines a headline can be, or maximum distances between text blocks?

## Phase 4: Growth Targets (KPI Config)
10. **Minimum Doable KPIs:** What are the baseline metrics required in the first 3 months to prove the concept works? (e.g., 1k followers/month).
11. **Dreamer KPIs:** What is the ultimate 2-year goal for monetization and audience size? (e.g., 2 Million followers, $10k/month brand deals).

---
*Once all answers are perfectly brainstormed, the Setup Architect will automatically populate `brand_config.json`, `designer_config.json`, and `kpi_targets.json`.*
