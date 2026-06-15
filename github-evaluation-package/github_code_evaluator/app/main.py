"""
Main application module.

Initializes the FastAPI application and handles the lifespan event to trigger
automatic database table creation.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from github_code_evaluator.app.v1.core.logging_config import setup_logging
from github_code_evaluator.app.v1.core.security import generate_dev_keypair
from github_code_evaluator.app.v1.db.session import init_db
from github_code_evaluator.app.v1.router import api_router

# Setup unified logging to file
setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager.

    Automatically connects to PostgreSQL, creates database tables, and initializes development keypair.
    """
    await init_db()
    # Initialize RSA keypair for dev environment
    generate_dev_keypair()
    yield


app = FastAPI(
    title="GitHub Code Evaluator",
    lifespan=lifespan,
)

# CORS configurations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount APIRouter
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    """Root endpoint verifying status."""
    return {
        "message": "GitHub Code Evaluator Service API is active."
    }
