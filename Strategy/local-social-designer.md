---
name: local-social-designer
description: Automatically executes multi-layout asset distribution and advanced typography scaling within the audited safe zones.
---

# 🎨 Local Social Designer: Advanced Layout Engine

This is the ultimate guide and execution logic for the advanced content layout engine. This agent strictly enforces visual hierarchy, dynamic layouts, and mathematically perfect typography scaling to generate pixel-perfect graphics natively without relying on repeated Vision API critiques.

## ⛔ Rule 1: The Ban on "Lazy Stretched Scaling"
Under no circumstances should the background images or safe zones be lazily stretched or squashed. The internal layout structures must completely re-arrange depending on the specific output canvas size (Square vs Vertical).

## 🛡️ Rule 2: The Content Sandbox (Safe Zones)
All dynamic text and images must exist **exclusively** within the absolute "Safe Working Zone". This prevents any overlap with the HashSYR24 logos, footers, and brand borders.

*   **1080x1350 (Portrait):** `left: 85px`, `top: 215px`, `width: 910px`, `height: 967px`
*   **1080x1920 (Vertical/Stories):** `left: 85px`, `top: 219px`, `width: 910px`, `height: 1516px`
*   **1080x1080 (Square):** Maintain a strict inner margin equivalent to the portrait safe zones, but calculated for the square height.

## 📐 Rule 3: Systematic Layout Archetypes
The generator must automatically choose a distinct visual arrangement based on the aspect ratio and whether an image is provided in the news source:

### 1. Square Posts (1080x1080)
*   **Text + Image Mode:** The layout uses a strict split. The news text container takes up **60%**, and the image occupies a beautifully composed **40%**.
*   **Text Only Mode:** Center-weight the text heavily. Force a massive headline using the **dual-weight headline technique** (Sub-headline Medium 500, Main Headline Bold 700). Distribute the content in a beautiful, balanced layout to make elegant use of the empty space.

### 2. Vertical Posts (1080x1920)
*   **Layout Structure:** Linear stacking alignment.
*   **Image Ratio:** The image occupies exactly **45%** of the safe content zone, creating a sharp visual anchor.
*   **Expansion Rules:** Elements must expand vertically to comfortably fill the screen depth. DO NOT leave huge blank voids at the bottom. Use the space to increase line height (`1.6` - `1.7`) and padding between bullet points.

## 🎨 Rule 4: Thematic Uniqueness
The generator must automatically apply distinct visual rules based on the layout theme. DO NOT mix styles:
*   **Black Theme:** Bullet points use numbers only (`01`, `02`). Numbers are positioned on the right. No colored dots.
*   **Green Theme:** Bullet points are perfectly centered text. No numbers, no dots. The first two words of each bullet point are rendered in `font-bold`, with the rest in regular weight.
*   **White & Urgent Themes:** Bullet points use a colored dot indicator on the right. No numbers.
*   **Urgent Theme Additions:** Includes a large `عاجل` red badge at the absolute top of the Typography zone.

## ⚙️ Rule 5: Dynamic Flexbox Layout Boundaries
To guarantee that the text never overflows the safe zones, we utilize a strictly bounded CSS Flexbox approach with specific distance limits:

1.  **Min/Max Distances:**
    *   **Minimum vertical gap between elements:** `24px` (e.g., space between sub-headline and main headline).
    *   **Maximum vertical gap between major zones:** `48px` (e.g., between the typography block and the image).
    *   **Image Flexible Height:** The visual anchor MUST absorb remaining space dynamically. In portrait (1350), it flexes between `40% (Min)` and `60% (Max)`. In vertical (1920), it flexes between `43% (Min)` and `75% (Max)`.
2.  **Typography Bounds:** The main headline must be explicitly split into two logical parts (split exactly in half). The first half is `font-medium`, and the second half is `font-bold` forced onto a new line (`<br/>`). It must NEVER exceed two lines. The typography container uses `max-height: 35%` and `overflow-hidden` to completely prevent safe zone bleeding.

## ✒️ Rule 6: Brand Identity & Typography
*   **Official Font:** `IBM Plex Sans Arabic`
*   **Colors:** Strict adherence to the 9-Color System (`#0d9488` for Teal accents, `#DBBE8F` for Gold, dark slate for text).
*   **Sub-headline:** Sized at `text-4xl` (36px) and flanked symmetrically by accent-colored horizontal lines.
*   **Main Headline:** Sized at `text-[56px]` (1350) or `text-[64px]` (1920).
*   **Glassmorphism:** Editorial containers use a `bg-white/50` or `bg-black/30` with `backdrop-blur-[40px]`. Text inside boxes maintains safe padding from all edges.

## 🚨 Rule 7: Mandatory Rule Verification Before Execution
Before executing any layout changes, generating a template, or writing code, the system MUST iterate over every single rule in this document. Any design choice that violates a safe margin, bleeds outside the bounding box, fails to apply multi-weights, mixes bullet styles incorrectly, or exceeds the maximum line counts is considered a catastrophic failure. Check all rules EVERY TIME.

By enforcing these rules, the Design Agent ensures that no matter how much or how little news text is generated, the font size instantly expands or shrinks to flawlessly occupy 100% of the assigned layout grid box with mathematical, pixel-perfect accuracy.

## Auto-Posting Aspect Ratio Rules
- **X (Twitter), Facebook, Instagram:** ALWAYS post the 1080x1350 version.
- **TikTok:** ALWAYS post the 1080x1920 (vertical) version.
