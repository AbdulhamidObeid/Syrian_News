# 🤖 HashSYR24 System Core Rules

> **IMPORTANT:** This file contains the absolute highest-priority rules for all AI Agents operating on the HashSYR24 project. These rules override all other instructions.

## 1. Absolute Modularity
The HashSYR24 pipeline is a modular, Multi-Agent System. 
- **NEVER hardcode** URLs, API endpoints, generation settings, brand colors, or visual aesthetics directly into `.js` or `.py` files.
- **ALWAYS read from `/Config/` JSON files** (e.g., `brand_config.json`, `sources_config.json`, `schedule_config.json`).
- If a new feature or property is added, you MUST add it to the relevant JSON config file and make the script read from it.

## 2. Blueprint Synchronization (The "Update Command")
Whenever a major update is requested and approved by the User (e.g., changing how a post is designed, altering the Editor's tone, or adding a new social platform):
- The Agent MUST locate the corresponding file in `/Blueprint/` (e.g., `02_editor_copywriter_agent.md` or `03_designer_agent.md`).
- The Agent MUST meticulously update the Markdown blueprint to reflect the new rule, logic, or constraint.
- The Agent MUST verify that all system files, JSONs, and Blueprints are in their correct folders (`/Blueprint`, `/Config`, `/Agent_Scripts`).
- **Goal:** The Blueprints must always act as the 100% accurate, up-to-date Source of Truth for the entire system.

## 3. Dynamic Tracking via `next_steps.md`
- The file `/next_steps.md` is the central nervous system for progress tracking.
- If the User says *"remind me of this later"* or *"we will do this in the future"*, the Agent MUST immediately append that item to `next_steps.md`.
- When an item is completed, the Agent MUST use markdown strikethrough (~~item~~) or change the checkbox (`[x]`) to mark it as done, explicitly mentioning the update to the User.
- The Agent should periodically review `next_steps.md` to suggest the next logical priority.

## 4. Browser Automation & Chrome Profiles (CRITICAL)
- The user has a dedicated, logged-in Chrome profile containing critical active sessions (Higgsfield, Telegram, etc.) located at `/Users/obeid/.gemini/antigravity-browser-profile`.
- **NEVER** launch a temporary browser or use tools like `$(mktemp -d)` when automating web tasks.
- **ALWAYS** launch Chrome using this exact background command before any generation/automation:
  `/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir="/Users/obeid/.gemini/antigravity-browser-profile"`
- All Node.js/Puppeteer scripts MUST connect to `http://127.0.0.1:9222` to utilize this active session instead of opening a new browser.
