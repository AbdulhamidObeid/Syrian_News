# HashSYR24 - Syrian News Automation Project

## Project Overview
This project is an autonomous, AI-driven news agency for **HashSYR24** (هاشتاق سوريا 24). It continuously scouts Syrian and global news, curates high-value content, rewrites it into specific visual "bento" constraints, and generates highly aesthetic social media posts (images, carousels, and videos) optimized for Facebook, Instagram, and X (Twitter).

The primary goal is **aggressive growth and virality** across all social channels by maximizing engagement, dwell time, and SEO (hashtags).

## Architecture & Engines
The system is divided into several autonomous engines running on a background PM2 instance:

1. **Scout Engine (`/Agent_Scripts/Scout_Engine/`)**: Scrapes Syrian news sources, global events, and Twitter feeds, consolidating them into `feed.json`.
2. **Editor Engine (`/Agent_Scripts/Editor_Engine/`)**: 
   - Uses the **Google Antigravity Python SDK** (`curator.py`) to tap into the dedicated AI Studio quota.
   - **Phase 1 (Scoring)**: Evaluates raw news (1-10) based on shareability, daily utility (currency, weather), and audience relevance. Prioritizes urgent/breaking news and high-impact global events (like the World Cup).
   - **Phase 2 (Copywriting)**: Rewrites selected news into structured JSON payloads conforming to strict visual constraints (T1/T2 headlines, bullet points). Also generates English image prompts and two sets of captions (Long for FB/IG, short for X) packed with SEO hashtags.
3. **Designer Engine (`/Agent_Scripts/Designer_Engine/`)**: Takes the Editor's JSON and uses AI to generate images/videos. Uses FFmpeg to convert static posts into MP4 Reels for Instagram exposure.
4. **Publisher Engine (`/Agent_Scripts/Publisher_Engine/`)**: Orchestrates the final API pushes to Facebook, Instagram, and X.
5. **Nightly Evaluator (`/Agent_Scripts/Nightly_Evaluator/`)**: Uses the Antigravity SDK (`nightly_evaluator.py`) at the end of each day to analyze the system's performance and any rejected posts. It dynamically rewrites the Editor's Blueprint (`02_editor_copywriter_agent.md`) to permanently learn from mistakes and optimize future content.

## Intelligence Bridge (Node.js -> Python)
- The main orchestration scripts are written in Node.js (`run_pipeline.js`, `curator.js`, `nightly_evaluator.js`).
- To utilize the powerful Antigravity AI Studio quota (100 RPD), the intelligence components have been migrated to Python (`curator.py`, `nightly_evaluator.py`).
- The Node.js scripts act as bridges, spawning `/opt/homebrew/bin/python3.10` subprocesses to execute the Python Antigravity agents.

## Core Rules for IDE Agents
Whenever assisting the human admin with this project, you MUST:
- **Respect the Quota Distinction**: The IDE chat window uses the IDE's built-in quota. The background scripts use the user's personal `GEMINI_API_KEY` via the Antigravity Python SDK.
- **Maintain Aesthetics**: The output is highly visual. Never break the headline character limits or the bullet point constraints defined in the Editor Blueprint.
- **Prioritize Virality**: Always optimize for features that drive engagement (Instagram Reels format, smart hashtags, compelling hooks).
- **Syrian Context**: Ensure all Arabic generated is standard and professional, but deeply attuned to the Syrian cultural and political context.
- **Automated Deployments & Updates Process**: Whenever a crucial fix is done or the code is updated, the agent MUST STRICTLY follow this detailed process without guessing:
  1. **Commit and Push to `main`**: Immediately stage the changed files and commit them with a highly descriptive, clear name detailing exactly what was fixed (e.g., `git commit -m "Fix: Handle null headline in refine_image payload to prevent AttributeError"`). Then run `git push origin main` (or simply `git push`).
  2. **Rerun the Engine**: Ensure the bot/engine is running the latest code. If a process is currently running, find it (e.g., by checking `engine.lock` or running `ps aux | grep run_pipeline.js`), kill it, and restart it in the background using `nohup npm start > engine.log 2>&1 &` (or the appropriate PM2 command if active). 
  3. **Detailed Technical Explanation**: Explain the exact root cause of the bug and the technical mechanics of the code fix to the human admin in the chat. Do NOT just say "I fixed it and pushed to git." You must explicitly break down the old buggy code vs the new fixed code so the admin and future agents understand the architecture changes.
