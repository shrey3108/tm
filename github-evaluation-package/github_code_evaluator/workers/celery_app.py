import sys
from celery import Celery
from github_code_evaluator.app.v1.core.config import settings
from github_code_evaluator.app.v1.core.logging_config import setup_logging

# Setup unified logging to file
setup_logging()

# Check if we are running in the context of the main app and can share its celery_app instance
celery_app = None
if "app.v1.core.celery_app" in sys.modules:
    try:
        from app.v1.core.celery_app import celery_app as main_celery_app
        celery_app = main_celery_app
    except ImportError:
        pass

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
