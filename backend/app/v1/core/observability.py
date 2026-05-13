"""
HireGo — Arize Phoenix Observability Setup
==========================================

Architecture:
    HireGo Backend  →  (OTLP traces)  →  Phoenix Docker  →  UI at :6006

Phoenix Docker command (ek baar chalao):
    docker run -p 6006:6006 -p 4317:4317 arizephoenix/phoenix:latest

Phir HireGo start karo — traces automatically Phoenix mein jaenge.

PHOENIX_COLLECTOR_ENDPOINT env var set karo .env mein:
    PHOENIX_COLLECTOR_ENDPOINT=http://localhost:4317
"""

import logging
import os

logger = logging.getLogger(__name__)


def setup_phoenix_tracing(project_name: str = "hirego-ai") -> bool:
    """
    OpenTelemetry tracing setup — traces Phoenix Docker pe bhejta hai.

    Kaise kaam karta hai:
    1. Phoenix Docker container pe OTLP endpoint hota hai (port 4317)
    2. Ye function HireGo backend ko configure karta hai
       ki sab traces wahan bheje
    3. OpenAI SDK (Ollama) ke sab calls automatically trace honge

    Returns:
        bool: True agar setup successful
    """
    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        from openinference.instrumentation.openai import OpenAIInstrumentor

        collector_endpoint = os.getenv(
            "PHOENIX_COLLECTOR_ENDPOINT",
            "http://localhost:4317"  # Phoenix Docker default
        )

        # Resource — Phoenix UI mein project naam ke roop mein dikhega
        resource = Resource.create({
            "project_name": project_name,
            "service.name": "hirego-backend",
            "service.version": "1.0.0",
        })

        # Tracer Provider setup
        provider = TracerProvider(resource=resource)

        # OTLP Exporter — Phoenix Docker pe traces bhejo
        exporter = OTLPSpanExporter(
            endpoint=collector_endpoint,
            insecure=True,
        )
        provider.add_span_processor(BatchSpanProcessor(exporter))

        # Global tracer set karo
        trace.set_tracer_provider(provider)

        # OpenAI SDK instrument karo
        # (Ollama bhi isi SDK se call hota hai — dono trace honge)
        OpenAIInstrumentor().instrument(tracer_provider=provider)

        logger.info(
            "Phoenix tracing active | Project: '%s' | "
            "Sending to: %s | UI: http://localhost:6006",
            project_name,
            collector_endpoint,
        )
        return True

    except ImportError as e:
        logger.warning(
            "Phoenix tracing disabled — missing package: %s\n"
            "Run: uv add opentelemetry-sdk opentelemetry-exporter-otlp "
            "openinference-instrumentation-openai",
            e,
        )
        return False
    except Exception as e:
        # Connection refused = Phoenix Docker nahi chala — ye normal hai
        if "Connection refused" in str(e) or "failed to connect" in str(e).lower():
            logger.warning(
                "Phoenix Docker not running. Start it with:\n"
                "  docker run -p 6006:6006 -p 4317:4317 arizephoenix/phoenix:latest\n"
                "Tracing disabled for now."
            )
        else:
            logger.error("Phoenix setup failed (non-critical): %s", e)
        return False


def get_tracer(name: str = "hirego"):
    """
    Custom spans ke liye tracer.

    Usage:
        tracer = get_tracer("hirego.resume")
        with tracer.start_as_current_span("extract-resume") as span:
            span.set_attribute("candidate_name", "Rahul")
            result = extractor.extract(...)
            span.set_attribute("skills_found", len(result.skills))
    """
    try:
        from opentelemetry import trace
        return trace.get_tracer(name)
    except ImportError:
        return _NoOpTracer()


class _NoOpTracer:
    """Fallback — silently kuch nahi karta jab OTel install nahi."""

    class _NoOpSpan:
        def set_attribute(self, *a, **kw): pass
        def record_exception(self, *a, **kw): pass
        def __enter__(self): return self
        def __exit__(self, *a): pass

    def start_as_current_span(self, name: str, **kwargs):
        return self._NoOpSpan()
