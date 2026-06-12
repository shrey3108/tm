import logging
import openai
import json
from app.v1.core.config import settings

from app.v1.prompts import PROMPT_ENHANCER_SYSTEM_PROMPT, PROMPT_ENHANCER_USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class PromptEnhancerService:
    """Service to enhance rough user prompts using the exact OpenAI client pattern used elsewhere."""
    
    def __init__(self):
        # Using the exact same initialization pattern as EvaluationAgent
        # Note: If OLLAMA_URL has a trailing slash, this becomes ...//v1
        # but the OpenAI client handles double slashes gracefully.
        self.client = openai.AsyncOpenAI(
            base_url=settings.OLLAMA_URL + "v1",
            api_key=settings.OLLAMA_API_KEY or "ollama"
        )

    async def enhance_prompt(self, name: str, rough_description: str) -> str:
        """
        Enhances the prompt using the same OpenAI client pattern used in evaluation/agent.py.
        """
        system_prompt = PROMPT_ENHANCER_SYSTEM_PROMPT
        user_prompt = PROMPT_ENHANCER_USER_PROMPT_TEMPLATE.format(
            name=name,
            rough_description=rough_description,
            name_lower=name.lower()
        )
        
        try:
            model_to_use = settings.ENHANCE_MODEL or settings.OLLAMA_MODEL
            response = await self.client.chat.completions.create(
                model=model_to_use,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3
            )
            
            content = response.choices[0].message.content
            
            if content and len(content.strip()) > 50:
                return content.strip()

            raise ValueError("Empty or invalid response from AI")

        except Exception as e:
            logger.error(f"Prompt Enhancement via OpenAI client failed: {e}")
            # Fallback
            return (
                f"Evaluate the candidate's {name.lower()}.\n"
                f"Consider: {rough_description}\n"
                f"Scoring rubric:\n"
                f"- 1: Very poor / No relevant skills shown\n"
                f"- 2: Below average / Significant weaknesses\n"
                f"- 3: Acceptable / Meets minimum requirements\n"
                f"- 4: Strong / Above average performance\n"
                f"- 5: Exceptional / Outstanding mastery"
            )

# Singleton instance
prompt_enhancer_service = PromptEnhancerService()
