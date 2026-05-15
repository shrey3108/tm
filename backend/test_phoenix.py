import os
import time
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.resources import Resource
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from openinference.semconv.resource import ResourceAttributes

# CONFIG
PROJECT_NAME = "hiring-platform"
COLLECTOR_URL = "http://localhost:4317"

print(f"--- PHOENIX CONNECTION TEST ---")
print(f"Target Project: {PROJECT_NAME}")
print(f"Target URL: {COLLECTOR_URL}")

# 1. Setup Resource
resource = Resource.create({
    ResourceAttributes.PROJECT_NAME: PROJECT_NAME,
    "project_name": PROJECT_NAME,
    "service.name": PROJECT_NAME,
})

# 2. Setup Provider
provider = TracerProvider(resource=resource)
exporter = OTLPSpanExporter(
    endpoint=COLLECTOR_URL, 
    insecure=True,
    headers={"project_name": PROJECT_NAME}
)
provider.add_span_processor(BatchSpanProcessor(exporter))
trace.set_tracer_provider(provider)

# 3. Create a Span
tracer = trace.get_tracer("test-tracer")
print("Sending test span...")

with tracer.start_as_current_span("TEST-CONNECTION-SPAN") as span:
    span.set_attribute("test.status", "success")
    span.set_attribute("test.time", time.time())
    print("Span created. Waiting for export...")

# 4. Cleanup
provider.shutdown()
print("Done! Please check Phoenix UI for 'hiring-platform' project.")
