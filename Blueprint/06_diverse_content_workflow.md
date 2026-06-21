# 📚 Content Schedule & Posting Strategy

This document defines the exact execution schedule and rules the HashSYR24 agents must follow for frequency, urgency, and platform distribution.

## 1. Platform Distribution Strategy
*   **Universal Design (Default):** The Designer Agent generates ONE high-quality master design (1080x1350). The Publisher Agent automatically adapts this single asset for all platforms (e.g., uploading the image to FB/IG/X).
*   **Telegram Notification:** When the Telegram Bot sends a post for approval, it will explicitly state the target platforms.

## 2. Posting Frequency & Quotas

The Scout and Publisher agents must adhere to the following rigid schedule matrix:

### A. Daily Routine Posts (Fixed Daily Deliverables)
These posts are guaranteed to go out every single day, regardless of the news cycle or the general news quota. They use predefined design templates (e.g., `1080x1350_white`).
1.  **Gold & Currency Prices (أسعار الذهب والعملات):** Posted daily at a fixed morning/afternoon time.
2.  **Fuel Prices & Utility Updates (أسعار المحروقات والخدمات):** Posted immediately when official bulletins are released by the Ministry.
3.  **Weather Forecast (الطقس):** Posted daily in the morning.

### B. General News (The Daily Quota)
*   **Frequency:** A fixed quota (e.g., 5 to 7 posts per day) spread out across peak engagement hours (e.g., 12 PM, 3 PM, 6 PM, 9 PM).
*   **Content:** Economics, sports, social news, and politics. If the Scout finds 20 news items, the Editor/Curator agent will score them and only push the top 5-7 highest-scoring stories to the Designer to fulfill the quota.

### C. Urgent News (عاجل) - The Quota Override
*   **Frequency:** Immediate.
*   **Rule:** When the Scout detects an event flagged as `URGENT` or `BREAKING` (e.g., major political decision, sudden economic shift), it completely bypasses the daily schedule and the fixed quota. 
*   **Action:** The agents drop their current tasks, use the `1080x1350_urgent` (Red) template, and push the post directly to the Telegram Admin Bot as an "EXTRA" post for immediate broadcast.

## 3. Carousel Workflows (Rich Content)
*   For deep-dives or top-5 lists, the Copywriter breaks the story into 3-6 slides. The Designer generates a sequence, and the Publisher uploads natively as a carousel on IG/FB.
