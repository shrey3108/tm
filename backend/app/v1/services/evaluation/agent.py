import json
import logging
import openai
from typing import Any, Dict, List, Optional
from app.v1.core.config import settings

from app.v1.prompts import EVALUATION_SYSTEM_PROMPT, EVALUATION_USER_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)

class EvaluationAgent:
    """
    LLM Synthesis Agent for final candidate evaluation.
    Uses the mentor-approved system prompt and structured JSON output.
    """

    def __init__(self):
        self.client = openai.AsyncOpenAI(
            base_url=settings.OLLAMA_URL + "v1",
            api_key=settings.OLLAMA_API_KEY or "ollama"
        )

    async def synthesize_evaluation(
        self, 
        transcript_text: str, 
        jd_text: str, 
        resume_text: str,
        calculated_scores: Dict[str, float],
        evidence_snippets: Dict[str, List[str]],
        criteria_names: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Final synthesis phase. Combines deterministic scores and evidence into a readable report.
        """
        
        # Prepare Resume Context section
        resume_section = ""
        resume_mention = "- Resume\n"
        if resume_text and resume_text.strip():
            resume_section = f"### CONTEXT:\nRESUME SUMMARY:\n{resume_text}\n"
        else:
            resume_mention = ""

        system_prompt = EVALUATION_SYSTEM_PROMPT.replace("{resume_mention}", resume_mention)

        # Prepare evidence context
        evidence_context = ""
        for criterion, snippets in evidence_snippets.items():
            evidence_context += f"\n### Criterion: {criterion}\n"
            for s in snippets:
                evidence_context += f"- \"{s}\"\n"

        # Prepare dynamic JSON schema based on active criteria
        schema_parts = []
        allowed_keys = []
        target_criteria = criteria_names if criteria_names else list(evidence_snippets.keys())
        for criterion in target_criteria:
            key = criterion.lower().replace(" ", "_")
            allowed_keys.append(key)
            schema_parts.append(f'    "{key}": {{ "score": int, "reasoning": "...", "confidence": float }}')
        json_schema = ",\n".join(schema_parts)

        user_prompt = EVALUATION_USER_PROMPT_TEMPLATE.format(
            criteria_list=', '.join(allowed_keys),
            jd_text=jd_text[:3000],
            resume_text=resume_text if resume_text else "Not provided",
            calculated_scores=json.dumps(calculated_scores, indent=2),
            evidence_context=evidence_context,
            transcript_text=transcript_text[:4000]
        )

        logger.info(f"LLM SYSTEM PROMPT: {system_prompt}")
        logger.info(f"LLM USER PROMPT: {user_prompt}")

        try:
            response = await self.client.chat.completions.create(
                model=settings.OLLAMA_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.0
            )

            raw_content = response.choices[0].message.content or "{}"
            logger.info(f"LLM Synthesis Raw Output: {raw_content}")
            
            # Robust JSON cleaning
            clean_content = raw_content.strip()
            if clean_content.startswith("```json"):
                clean_content = clean_content.split("```json", 1)[1]
            if "```" in clean_content:
                clean_content = clean_content.split("```", 1)[0]
            clean_content = clean_content.strip()
            
            try:
                return json.loads(clean_content)
            except json.JSONDecodeError as je:
                logger.warning(f"Initial JSON parse failed: {je}. Attempting basic repair...")
                # Basic repair: remove trailing commas before closing braces/brackets
                import re
                repaired = re.sub(r',\s*([\]}])', r'\1', clean_content)
                return json.loads(repaired)
                
        except Exception as e:
            logger.error(f"LLM Synthesis failed: {e}")
            return {"error": f"AI Synthesis Error: {str(e)}"}

evaluation_agent = EvaluationAgent()
