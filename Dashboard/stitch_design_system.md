# 📊 Analytics Dashboard Design System (Stitch UI)

> **Agent Instruction (Setup Architect):** Feed this document to **Stitch** to guarantee the dashboard UI strictly follows our brand identity and provides a world-class user experience.

## 1. Brand Adherence
The dashboard must use the exact colors defined in `brand_config.json`.
*   **Primary Background:** Use `neutrals.off_black` for a sleek, modern dark mode.
*   **Cards/Containers:** Use `neutrals.dark_gray` with subtle borders (`primaries.deep_pine`).
*   **Accents/Buttons:** Use `primaries.teal` for primary actions and `accents.gold` for highlighting key metrics or "Dreamer KPI" achievements.
*   **Typography:** The entire UI must use `IBM Plex Sans Arabic` (or the font defined in `primary_fonts`).

## 2. The 3-Option Design Phase
When generating the dashboard, you must:
1. Provide the user with **Version A** (e.g., a "Command Center" layout with massive number widgets).
2. Provide the user with **Version B** (e.g., a "Flow" layout focusing heavily on line graphs and growth trajectories).
3. Ask the user: "Would you like to provide a reference image or specific UI inspiration for a third option?"
*Wait for the user to select the final layout before fully integrating.*

## 3. Required Data Modules
The final Dashboard UI must contain these specific components:
*   **The KPI Tracker:** A dual progress bar showing current stats against the "Minimum Doable" targets and the "Dreamer" targets (from `kpi_targets.json`).
*   **Platform Leaderboard:** A grid showing follower acquisition rates across Facebook, Instagram, X, and TikTok.
*   **Top Scorers:** A visual gallery of the top 5 highest-performing posts of the week, displaying the creative and the exact interaction numbers.
