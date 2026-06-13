# 📚 Diverse Content & Carousel Generation Workflow

The pipeline must support various depths of content to keep the audience engaged and satisfy the algorithms.

## 1. The Single Image (Breaking News)
*   **Trigger:** Urgent news, daily utility (weather, gold prices), or simple announcements.
*   **Workflow:** The Editor scores the news -> Copywriter creates a single 2-sentence brief -> Designer generates one 1080x1350 image.

## 2. The Deep-Dive Carousel (Rich Content)
*   **Trigger:** Topics requiring depth, such as the history of a Syrian city, a profile of a prominent figure, deep societal analysis, or a top 5 list.
*   **Copywriter Rules:** The Copywriter must break the story into 3-6 distinct slides. Slide 1 is the Hook/Headline. Slides 2-4 are the body. Slide 5 is the Call to Action (CTA).
*   **Designer Rules:** The Designer agent must intercept this multi-part output and generate a numbered sequence of 1080x1350 images. 
*   **Publisher Rules:** The Publisher agent (Puppeteer) must detect if an array of images is provided and use the platform's native carousel/multi-image upload feature.
