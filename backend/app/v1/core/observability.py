import os
import logging
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.resources import Resource
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from openinference.instrumentation.openai import OpenAIInstrumentor
from openinference.semconv.resource import ResourceAttributes
from app.v1.core.config import settings

logger = logging.getLogger(__name__)

def get_tracer(name: str):
    """
    Returns a tracer from the global tracer provider.
    """
    return trace.get_tracer(name)

def setup_phoenix_tracing(project_name: str | None = None):
    """
    Sets up OpenTelemetry tracing to send data to Arize Phoenix.
    """
    if not settings.ENABLE_OBSERVABILITY:
        logger.info("Observability is disabled via ENABLE_OBSERVABILITY setting.")
        return

    try:
        collector_endpoint = settings.PHOENIX_COLLECTOR_ENDPOINT
        project_name = project_name or settings.PHOENIX_PROJECT_NAME

        # Force environment variables for SDKs that check them directly
        os.environ["PHOENIX_PROJECT_NAME"] = project_name
        os.environ["OTEL_SERVICE_NAME"] = project_name

        # 1. Resource Setup
        resource = Resource.create({
            ResourceAttributes.PROJECT_NAME: project_name,
            "project_name": project_name,
            "service.name": project_name,
        })

        # 2. Provider Setup
        provider = TracerProvider(resource=resource)
        
        # Auto-translate gRPC port (4317) to HTTP/proto endpoint (6006/v1/traces)
        if collector_endpoint == "http://localhost:4317":
            collector_endpoint = "http://localhost:6006/v1/traces"
        elif "phoenix:4317" in collector_endpoint:
            collector_endpoint = collector_endpoint.replace("phoenix:4317", "phoenix:6006/v1/traces")
        elif collector_endpoint.endswith(":4317"):
            collector_endpoint = collector_endpoint.replace(":4317", ":6006/v1/traces")
        elif not collector_endpoint.endswith("/v1/traces"):
            collector_endpoint = collector_endpoint.rstrip("/") + "/v1/traces"

        # 3. Exporter Setup (HTTP OTLP)
        exporter = OTLPSpanExporter(
            endpoint=collector_endpoint, 
            headers={"project_name": project_name}
        )
        provider.add_span_processor(BatchSpanProcessor(exporter))
        
        # 4. Global Settings
        trace.set_tracer_provider(provider)
        
        # 5. Instrument OpenAI / Ollama
        instrumentor = OpenAIInstrumentor()
        if instrumentor.is_instrumented_by_opentelemetry:
            instrumentor.uninstrument()
        instrumentor.instrument(tracer_provider=provider, skip_dep_check=True)

        print(f"DEBUG: APPLYING WORKING SCRIPT LOGIC | Project: '{project_name}' | Endpoint: '{collector_endpoint}'")
        logger.info("Phoenix Tracing initialized for project: %s (using HTTP exporter)", project_name)

    except Exception as e:
        logger.error(f"Failed to setup Phoenix tracing: {e}", exc_info=True)
