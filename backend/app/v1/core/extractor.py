"""
Resume extraction services.

This module provides services for parsing document files (PDF, DOCX) and
extracting structured information from resume text using LLMs.
"""

from pathlib import Path
import docx2txt
import pymupdf
from langextract import extract
from langextract.core.data import AnnotatedDocument
from langextract.core.types import FormatType
from langextract.providers.ollama import OllamaLanguageModel
from tenacity import (
    retry,
    retry_if_not_exception_type,
    stop_after_attempt,
    wait_fixed,
)

from app.v1.core.config import settings
from app.v1.core.storage import resolve_storage_path
from app.v1.prompts import (
    RESUME_EXTRACTION_EXAMPLES,
    RESUME_EXTRACTION_PROMPT,
)
from opentelemetry import trace
from opentelemetry.trace import StatusCode
from openinference.semconv.trace import SpanAttributes, OpenInferenceSpanKindValues
from app.v1.core.observability import get_tracer

tracer = get_tracer("hiring-platform.extractor")

print("[LOADED] extractor.py")

class DocumentParser:
    """Handles text extraction from various document formats.

    Supports PDF and DOCX text extraction.
    """

    @staticmethod
    def extract_text(file_path: str | Path) -> str:
        """Extract text from a given file path based on its extension.

        Args:
            file_path: Absolute or relative path to the document file.

        Returns:
            The extracted text as a single string.

        Raises:
            FileNotFoundError: If the file does not exist.
            ValueError: If the file format is unsupported.
        """
        # Robust path resolution for Windows/Unix compatibility
        path = resolve_storage_path(file_path).resolve()
        
        if not path.is_file():
            raise FileNotFoundError(f"File not found or is not a file: {path}")

        ext = path.suffix.lower()

        if ext == ".pdf":
            return DocumentParser._extract_from_pdf(path)
        elif ext in [".docx", ".doc"]:
            return DocumentParser._extract_from_docx(path)
        else:
            raise ValueError(f"Unsupported file format: {ext}")

    @staticmethod
    def _extract_from_pdf(file_path: Path) -> str:
        """Extract text from a PDF document using PyMuPDF."""
        pages_text = []
        try:
            with pymupdf.open(file_path) as doc:
                for page in doc:
                    pages_text.append(page.get_text())
        except Exception as e:
            raise RuntimeError(f"Error parsing PDF: {str(e)}")

        return "".join(pages_text)

    @staticmethod
    def _extract_from_docx(file_path: Path) -> str:
        """Extract text from a DOCX document."""
        try:
            return docx2txt.process(str(file_path))
        except Exception as e:
            raise RuntimeError(f"Error parsing DOCX: {str(e)}")


class ResumeLLMExtractor:
    """Handles structured extraction of resume information using LLMs."""

    def __init__(self):
        """Initialize the extractor with the configured LLM provider."""
        from langextract.providers.openai import OpenAILanguageModel

        if "/v1" in settings.OLLAMA_URL:
            self.model = OpenAILanguageModel(
                model_id=settings.OLLAMA_MODEL,
                base_url=settings.OLLAMA_URL,
                api_key=settings.OLLAMA_API_KEY,
                timeout=settings.OLLAMA_TIMEOUT,
                format_type=FormatType.JSON,
            )
        else:
            self.model = OllamaLanguageModel(
                model_id=settings.OLLAMA_MODEL,
                model_url=settings.OLLAMA_URL,
                api_key=settings.OLLAMA_API_KEY,
                timeout=settings.OLLAMA_TIMEOUT,
                format_type=FormatType.JSON,
            )

    @retry(
        retry=retry_if_not_exception_type(ValueError),
        stop=stop_after_attempt(settings.LANGEXTRACT_RETRY_ATTEMPTS),
        wait=wait_fixed(settings.LANGEXTRACT_RETRY_DELAY),
        reraise=True,
    )
    def extract_resume_info(
        self, text: str
    ) -> AnnotatedDocument | list[AnnotatedDocument]:
        """Extract structured information from resume text using LangExtract."""
        if not text or not text.strip():
            raise ValueError("No text provided for extraction.")

        with tracer.start_as_current_span("extract-resume-info") as span:
            span.set_attribute(SpanAttributes.OPENINFERENCE_SPAN_KIND, OpenInferenceSpanKindValues.LLM.value)
            span.set_attribute(SpanAttributes.INPUT_VALUE, text)
            span.set_attribute(SpanAttributes.LLM_PROMPT_TEMPLATE, RESUME_EXTRACTION_PROMPT)
            span.set_attribute("text_length", len(text))
            
            try:
                result = extract(
                    text_or_documents=text,
                    model=self.model,
                    prompt_description=RESUME_EXTRACTION_PROMPT,
                    examples=RESUME_EXTRACTION_EXAMPLES,
                    debug=settings.DEBUG,
                )
                
                # Success and Result Capture
                span.set_attribute("extraction_success", True)
                if result:
                    # Convert result to string/json for visibility
                    span.set_attribute(SpanAttributes.OUTPUT_VALUE, str(result))
                    
                    # Try to extract usage from metadata if langextract provides it
                    usage_found = False
                    try:
                        # Check various common metadata locations in langextract/annotated docs
                        metadata = getattr(result, "metadata", {}) or {}
                        usage = metadata.get("usage") or metadata.get("token_usage")
                        if usage:
                            span.set_attribute(SpanAttributes.LLM_TOKEN_COUNT_PROMPT, usage.get("prompt_tokens", 0))
                            span.set_attribute(SpanAttributes.LLM_TOKEN_COUNT_COMPLETION, usage.get("completion_tokens", 0))
                            span.set_attribute(SpanAttributes.LLM_TOKEN_COUNT_TOTAL, usage.get("total_tokens", 0))
                            usage_found = True
                    except:
                        pass
                        
                    # Fallback: Estimate tokens if not provided by library (1 token ~= 4 chars)
                    if not usage_found:
                        prompt_tokens = len(text) // 4
                        completion_tokens = len(str(result)) // 4
                        span.set_attribute(SpanAttributes.LLM_TOKEN_COUNT_PROMPT, prompt_tokens)
                        span.set_attribute(SpanAttributes.LLM_TOKEN_COUNT_COMPLETION, completion_tokens)
                        span.set_attribute(SpanAttributes.LLM_TOKEN_COUNT_TOTAL, prompt_tokens + completion_tokens)
                        span.set_attribute("llm.usage.is_estimated", True)
                
                span.set_status(StatusCode.OK)
                span.set_attribute("status", "OK") # Explicit attribute for dashboard
                return result
            except Exception as e:
                span.set_status(StatusCode.ERROR, str(e))
                span.record_exception(e)
                print(f"Error during LLM extraction: {e}")
                raise e
