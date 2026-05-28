"""
Resume execution engine.

This module provides a thread pool executor for processing resumes
asynchronously in background threads to avoid blocking the event loop.
"""

from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from typing import Any, Callable, TypeVar

from app.v1.core.config import settings

T = TypeVar("T")

_resume_executor: ThreadPoolExecutor | None = None


def initialize_resume_executor() -> None:
    """Initialize the global thread pool executor for resume processing.

    This function sets up a ThreadPoolExecutor with a configured number of workers
    and a specific thread name prefix for observability.
    """
    global _resume_executor

    if _resume_executor is None:
        _resume_executor = ThreadPoolExecutor(
            max_workers=settings.RESUME_PROCESSING_MAX_WORKERS,
            thread_name_prefix="resume-worker",
        )


def shutdown_resume_executor() -> None:
    """Shutdown the global resume executor.

    Cleans up the thread pool executor and its threads.
    """
    global _resume_executor

    if _resume_executor is not None:
        _resume_executor.shutdown(wait=True, cancel_futures=False)
        _resume_executor = None


async def run_in_resume_executor(
    func: Callable[..., T],
    /,
    *args: Any,
    **kwargs: Any,
) -> T:
    """Run a CPU-bound or blocking function in the resume executor.

    Args:
        func: The callable to execute in a separate thread.
        *args: Positional arguments to pass to the function.
        **kwargs: Keyword arguments to pass to the function.

    Returns:
        The result of the function execution.
    """
    if _resume_executor is None:
        initialize_resume_executor()

    from opentelemetry.context import get_current, attach, detach
    ctx = get_current()

    def wrapped_func(*w_args, **w_kwargs):
        token = attach(ctx)
        try:
            return func(*w_args, **w_kwargs)
        finally:
            detach(token)

    loop = asyncio.get_running_loop()
    bound_callable = partial(wrapped_func, *args, **kwargs)
    return await loop.run_in_executor(_resume_executor, bound_callable)

