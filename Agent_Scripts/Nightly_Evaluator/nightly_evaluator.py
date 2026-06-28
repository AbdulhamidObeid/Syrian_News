import os
import sys
import json
import asyncio
import pydantic
from google.antigravity import Agent, LocalAgentConfig

# Ensure environment variables are loaded
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env'))

class NightlyReport(pydantic.BaseModel):
    newBlueprint: str
    telegramSummary: str

async def run_nightly_evaluation(input_path: str, output_path: str):
    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    post_count = data.get("postCount", 0)
    rejections = data.get("rejections", [])
    current_blueprint = data.get("currentBlueprint", "")

    prompt = f"""You are the HashSYR24 Director Agent (Antigravity Nightly Evaluator).
Your job is to evaluate our entire system performance for today, read the current Editor Blueprint, and analyze any REJECTIONS (mistakes made by the AI today that the human admin rejected).
You must REWRITE the Blueprint to include new, permanent rules based on the rejections OR based on new social media algorithm tricks (like maximizing Reels, dwell time, and hashtag SEO).
You must also write a comprehensive Morning Report for the Admin, summarizing what you improved and providing a strategic tip for tomorrow.

=== TODAY'S DATA ===
Total Posts Published: {post_count}
Rejections: {json.dumps(rejections, ensure_ascii=False, indent=2)}

=== CURRENT BLUEPRINT ===
{current_blueprint}

=== INSTRUCTIONS ===
1. Generate the completely updated Blueprint markdown. Do NOT delete existing rules. Append new strong rules based on rejections and growth strategies.
2. Generate a Telegram Summary message (using HTML formatting like <b>bold</b> and <i>italic</i>). It should summarize the changes made to the blueprint, review today's performance, and give a strategic tip for tomorrow's content to maximize exposure.
3. Output the result strictly as a structured response containing "newBlueprint" and "telegramSummary".
"""

    config = LocalAgentConfig(
        model="gemini-2.0-flash",
        response_schema=NightlyReport,
    )

    async with Agent(config) as agent:
        response = await agent.chat(prompt)
        data_out = await response.structured_output()

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data_out, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    asyncio.run(run_nightly_evaluation(input_file, output_file))
