# Template Creation Rules

This document outlines the strict rules that any Agent must follow when manipulating, creating, or exporting Adobe Illustrator templates (`.ai`) for the Syrian News project.

## 1. Background Layer Management
When dynamically creating or updating an `.ai` layout from a raw background image (`.jpg` or `.png`):
- Place the image on **Layer 1** and rename it to `Background`.
- **CRITICAL**: The `Background` layer must **NEVER** be locked by the script. The user needs to manually add their headers, footers, and other structural assets directly onto this layer.

## 2. The 1% Expansion Rule
When placing a raw background image onto an artboard:
- You must computationally scale the image to **101%** of the artboard's dimensions (expand by 1%).
- The image must then be perfectly re-centered so the 1% extra size bleeds equally off all edges.
- This ensures there are absolutely no white 1-pixel borders or alignment gaps during the final JPG extraction.

## 3. Safe Zone Layering
- Every template must have a secondary layer stacked on top named `Safe Zone`.
- This layer is used to define the safe visual area using white boxes, preventing dynamic text from overlapping the permanent header/footer graphics.
- During final extraction, the `Safe Zone` layer must always be hidden.

---
*Failure to follow these exact specifications will result in broken graphic alignments and severely disrupt the Publisher pipeline.*
