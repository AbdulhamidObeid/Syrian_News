# Video Creation Guide & Strategy
**Project:** HashSYR24 (هاشتاق سوريا)
**Core Engine:** Remotion (React-based Video Automation)

## Overview
Our goal is to produce top-tier, broadcast-quality news videos at scale without relying on manual video editing software like After Effects or Premiere Pro. By leveraging **Remotion**, we can generate high-end motion graphics entirely through code. This allows the AI agent to instantly swap out news headlines, data, and imagery, and render a final MP4 on demand.

---

## 1. The Design Aesthetic
We are aiming for a highly polished, modern "Agency" look, completely avoiding basic, stiff animations.
*   **Colors:** Charcoal (`#161616`) and Gold (`#E5C07B`).
*   **Typography:** **Cairo** (via Google Fonts), utilizing heavy bold weights for headlines and high tracking/letter-spacing for premium visual appeal.
*   **Motion Feel:** Smooth, dynamic, and soft. We use spring physics and bezier curves to ensure elements slide, bounce, and fade in naturally, mirroring top-tier news networks like Al Jazeera.

---

## 2. The Production Workflow
To achieve world-class fluid animations without hand-coding complex bezier curves for every single element, we use a hybrid approach:

1.  **Source Blank Motion Assets:** We find highly complex, pre-animated vector files (Lottie/JSON) from professional motion designers. We strictly look for *blank* assets (e.g., lower-thirds without text, abstract background loops, bouncing speech bubbles, or pulsing radar maps).
2.  **Agent Extraction:** The user sends the link to the AI agent. The agent uses its browser tools to scrape, download, and store the raw `.json` animation file in the project.
3.  **Remotion Integration:** The agent uses `@remotion/lottie` to integrate the file into our rendering pipeline.
4.  **Dynamic Customization:** 
    *   **Recoloring:** The agent dynamically alters the JSON data to replace the original colors with our official Charcoal and Gold.
    *   **Typography Overlay:** The agent codes our dynamic text layers (using the Cairo font) *on top* of the imported blank animations.
5.  **Visual Quality Assurance (QA):** Before sending the final video to the user, the agent runs `npx remotion still` to extract keyframes (e.g., frame 60 and 150) as PNG images. The agent uses its vision capabilities to visually inspect the exact layout, colors, and asset scaling.
6.  **Automated Rendering:** Once verified, the agent runs the build command to export the final MP4.

---

## 3. Approved Free Resources
When looking for high-end motion graphics to feed into our engine, use these libraries. *Note: Always filter by "Free".*

*   **[LottieFiles](https://lottiefiles.com/):** The primary source. A massive marketplace of JSON-based vector animations created by After Effects professionals. Look here for radar pulses, lower-third reveals, and background loops.
*   **[Lordicon](https://lordicon.com/):** The best library for extremely premium, fluidly animated icons (delivered as Lottie JSON files). Great for weather, alerts, and UI accents.
*   **[Rive Community](https://rive.app/community/):** A modern alternative to Lottie offering state-machine-driven animations with insanely soft and dynamic motion physics.

---

## 4. How to Request a New Template
If you see a video you like on Twitter or TV and want to replicate it:
1.  Share the link to the video with the agent.
2.  The agent will take a screenshot/analyze the exact frame layout.
3.  Find a corresponding blank motion asset on LottieFiles (if necessary for complex shapes).
4.  The agent will code the structural layout, map the colors to our brand identity, and apply Remotion physics to the text overlays.
5.  The agent will perform a Visual QA extraction and then render the final video.

*(This guide will be continually updated as our technical pipeline evolves during implementation.)*
