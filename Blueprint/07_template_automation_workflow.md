# 🖼️ Automated Template Workflow

> **Agent Instruction (Setup Architect):** This is the exact workflow you must follow to generate the visual templates for a new project. You must handle the folder creation and routing automatically so the user cannot make a mistake.

## Step 1: Directory Setup
Immediately create the `/Assets/BGs` and `/Assets/Templates` subfolders. 

## Step 2: The Base `BGs.ai` Creation
Generate a master Adobe Illustrator file named exactly `BGs.ai` inside the `/Assets/BGs/` folder.
* The user will use this file to design and export as many `.jpg` background color variations as needed into the `/Assets/BGs/` folder.

## Step 3: Generating the 8 AI Templates
Once the raw `.jpg` backgrounds exist in `/Assets/BGs/`, the Agent must automatically generate a `.ai` layout file for each one inside `/Assets/Templates/`.
*   **Naming**: Name the `.ai` files exactly like the exported `.jpg` files (e.g. `1080x1350_green.ai`).
*   **Layer 1 (Background)**: The Agent places the `.jpg` here.
    *   **CRITICAL RULE 1**: The Agent must computationally scale the placed `.jpg` to **101%** of the artboard size and perfectly re-center it to prevent white borders.
    *   **CRITICAL RULE 2**: The `Background` layer must **never** be locked by the script, so the user can easily add their permanent headers and footers to it.
*   **Layer 2 (Safe Zone)**: The Agent creates a top layer exactly named "Safe Zone".

## Step 4: User Handoff
Notify the user: "I have created the 8 templates in `/Assets/Templates/`. Please open them, add your headers/footers to the Background layer, and draw a white box in the Safe Zone layer to represent your margins."

## Step 5: The Automation Extraction
Once the user confirms they are done designing the headers/footers:
1. The Designer agent automatically reads the X/Y coordinates and width/height of the white boxes on the "Safe Zone" layer and updates `/Config/designer_config.json`.
2. The agent automatically **hides** the "Safe Zone" layer in all 8 files.
3. The agent exports the final layered artboards as `.jpg` files directly into `/Assets/Templates/`.
4. The HTML `Designer_Engine` uses these final extracted `.jpg` files (with the headers and footers) to dynamically generate the daily social media graphics.
