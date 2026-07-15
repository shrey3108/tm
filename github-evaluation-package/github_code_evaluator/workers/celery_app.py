import sys
from celery import Celery
from github_code_evaluator.app.v1.core.config import settings
from github_code_evaluator.app.v1.core.logging_config import setup_logging

# Setup unified logging to file
setup_logging()

celery_app = None

if celery_app is None:
    celery_app = Celery(
        "github_evaluator_workers",
        broker=settings.CELERY_BROKER_URL,
        backend=settings.CELERY_RESULT_BACKEND,
    )

    celery_app.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
        imports=["github_code_evaluator.workers.tasks"],
        task_default_queue="github_evaluation",
        worker_concurrency=settings.CELERY_WORKER_CONCURRENCY,
    )
