FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv package manager
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Copy project files
COPY pyproject.toml .
COPY README.md .
COPY backend ./backend
COPY augustlab_packages ./augustlab_packages
COPY github-evaluation-package ./github-evaluation-package

# Install dependencies
RUN uv pip install --system -e ./augustlab_packages/auth -e ./github-evaluation-package -e ./backend

WORKDIR /app/backend

EXPOSE 8000

CMD ["python", "-m", "fastapi", "run", "app/main.py", "--host", "0.0.0.0", "--port", "8000"]
