# 🎬 Video Pipeline & Motion Strategy (HashSYR24)

This document outlines the exact roadmap for building the Video Engine once the image pipeline is monetized. The goal is to produce Al-Jazeera quality motion graphics without writing complex animation math from scratch.

## 1. The Core Technology Stack
*   **Backgrounds (B-Roll):** Higgsfield AI. We will generate photorealistic, dark, premium Syrian cityscapes and abstract data streams.
*   **The Engine:** Remotion (React for Video). It allows us to render `.mp4` files via Node.js using web technologies.
*   **The Motion:** Framer Motion & Lottie. Instead of coding complex keyframes, we use Lottie JSON files (free After Effects animations) for lower-thirds, and Framer Motion for text that glides onto the screen smoothly.

## 2. Preparing the Motion Templates (What We Need)
Before the Video Agent can work, we must build a "Template Library" just like we did for the Designer Agent:
1.  **Lower Thirds (شريط عاجل):** A glowing red (Urgent) or black (Analytical) bar that slides in from the bottom.
2.  **The Intro/Outro Stings:** A 2-second high-energy logo reveal of `HashSYR24` with a sound effect.
3.  **The Transitions:** Simple smooth whip-pans or light-leaks to transition between clips.

*Actionable Step:* We will source free Lottie files for these elements, color them to match our Deep Pine Green and Crimson brand guidelines, and save them in `Assets/Video_Templates/`.

## 3. The Video Agent Workflow
When the Editor writes a script, the Video Agent will:
1.  **Split the Script:** Break the text into 3-second read chunks.
2.  **Fetch Assets:** Grab the corresponding B-roll video from Higgsfield or our library.
3.  **Compile with Remotion:** The agent feeds the text chunks into our Remotion React template. The template automatically applies the Lower Third Lottie animation, places the text over the B-roll, and renders a 15-second `1080x1350` MP4 file.
4.  **Publish:** The Publisher Agent natively uploads it as a Reel/TikTok.

## 4. Why not After Effects?
Automating Adobe After Effects via `nexrender` is incredibly powerful but requires a heavy, expensive server to run Photoshop/AE. Remotion runs instantly on standard cloud servers and is free to develop. We will stick to Remotion + Framer Motion for massive speed and zero server costs.
