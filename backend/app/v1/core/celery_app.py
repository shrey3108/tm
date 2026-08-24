"""
Celery configuration module.

This module initializes the Celery application and configures it to use
Redis as the message broker.
"""

# Fallback redis-py connection to RESP2 protocol if HELLO command fails on older Redis servers
try:
    import redis
    from redis.exceptions import ResponseError

    _orig_on_connect = redis.Connection.on_connect_check_health

    def _patched_on_connect(self, check_health: bool = True):
        try:
            _orig_on_connect(self, check_health=check_health)
        except ResponseError as err:
            if "HELLO" in str(err) or "unknown command" in str(err):
                self.protocol = 2
                if hasattr(self, "maint_notifications_config") and self.maint_notifications_config:
                    self.maint_notifications_config.enabled = False
                self.set_parser(redis.connection._RESP2Parser)
                _orig_on_connect(self, check_health=check_health)
            else:
                raise

    redis.Connection.on_connect_check_health = _patched_on_connect
except Exception:
    pass

from celery import Celery
from celery.signals import worker_process_init

from app.v1.core.config import settings
from app.v1.core.observability import setup_phoenix_tracing

celery_includes = [
    "app.v1.services.resume_upload.tasks",
    "app.v1.services.admin.job_tasks",
    "app.v1.services.evaluation_tasks",
    "app.v1.services.transcript_tasks",
    "app.v1.services.reminder_tasks"
]

try:
    import github_code_evaluator
    celery_includes.append("github_code_evaluator.workers.tasks")
except ImportError:
    pass

celery_app = Celery(
    "worker",
    broker=settings.CELERY_BROKER_URL,
    include=celery_includes,
)

@worker_process_init.connect
def init_worker(**kwargs):
    """
    Initialize the worker process.
    Preloads the embedding model to avoid first-task latency.
    """
    from app.v1.core.embeddings import preload_embedding_model
    preload_embedding_model()
    
    # Initialize Phoenix Tracing for the worker
    setup_phoenix_tracing(project_name=settings.PHOENIX_PROJECT_NAME)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    broker_transport_options={"protocol": 2},
    result_backend_transport_options={"protocol": 2},
)

# Configure Celery Beat for periodic tasks
celery_app.conf.beat_schedule = {
    "deactivate-expired-jobs-every-hour": {
        "task": "deactivate_expired_jobs_task",
        "schedule": 3600.0,  # Run every hour (3600 seconds)
    },
    "send-associate-reminders-every-hour": {
        "task": "send_associate_reminders_task",
        "schedule": 3600.0,
    },
    "auto-trigger-github-evaluations-every-hour": {
        "task": "auto_trigger_github_evaluations_task",
        "schedule": 3600.0,
    },
    "expire-failed-evaluations-every-hour": {
        "task": "github_code_evaluator.workers.tasks.expire_failed_evaluations_task",
        "schedule": 3600.0,
    },
}
