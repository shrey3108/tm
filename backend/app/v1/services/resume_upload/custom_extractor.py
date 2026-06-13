"""
Service for dynamic custom extraction from resumes.
"""

import json
import logging

import openai

from app.v1.core.config import settings

logger = logging.getLogger(__name__)

class CustomResumeExtractorService:

    async def extract_background_custom_fields(
        self,
        raw_text: str,
        fields_list: list[str],
    ) -> dict[str, str]:
        """Extract custom fields from raw text in the background, without throwing HTTP exceptions."""
        if not fields_list:
            return {}
            
        fields_json = json.dumps([{"title": field, "description": field} for field in fields_list], indent=2)
        
        system_prompt = (
            "You are an expert HR data parser. Your task is to extract dynamic fields from a resume.\n"
            "CRITICAL:\n"
            "1. You MUST output ONLY valid JSON format.\n"
            "2. Your output MUST be a JSON object with a single key 'results' which is an array.\n"
            "3. If a requested field is NOT found in the resume, set its value exactly to 'no'.\n"
            "4. Be very concise with your answers."
        )
        
        user_prompt = f"""
Extract exactly these fields from the candidate's resume:
{fields_json}

Output Format Example (JSON ONLY):
{{
  "results": [
    {{"title": "Requested Title 1", "value": "Extracted string or 'no'"}},
    {{"title": "Requested Title 2", "value": "..."}}
  ]
}}

RESUME TEXT:
{raw_text[:6000]}
"""

        try:
            client = openai.AsyncOpenAI(
                base_url=settings.OLLAMA_URL + "v1",
                api_key=settings.OLLAMA_API_KEY or "ollama"
            )
            response = await client.chat.completions.create(
                model=settings.OLLAMA_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )

            response_text = response.choices[0].message.content or "{}"
            response_text = response_text.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()

            data = json.loads(response_text)
            results = data.get("results", [])
            
            extracted_dict = {}
            for item in results:
                title = item.get("title", "Unknown")
                value = str(item.get("value", "no"))
                extracted_dict[title] = value
                
            return extracted_dict

        except Exception as e:
            logger.error("Background LLM Extraction failed: %s", e)
            return {field: "Error extracting" for field in fields_list}

custom_extractor_service = CustomResumeExtractorService()
