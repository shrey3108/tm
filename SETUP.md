# HR Platform Setup Guide

This project is split into two main parts: the backend and the frontend. Please follow the instructions in each directory's setup guide to get the full platform running.

- [HR Platform Setup Guide](#hr-platform-setup-guide)
  - [Setup](#setup)
    - [1. Backend Setup](#1-backend-setup)
      - [Option 1: Running with Docker (Recommended)](#option-1-running-with-docker-recommended)
        - [Prerequisites](#prerequisites)
        - [Steps](#steps)
      - [Option 2: Running Without Docker (Local Development)](#option-2-running-without-docker-local-development)
        - [Prerequisites](#prerequisites-1)
        - [Steps](#steps-1)
    - [Project Structure](#project-structure)
    - [Notes](#notes)
    - [Verification](#verification)
    - [2. Frontend Setup Guide](#2-frontend-setup-guide)
      - [Prerequisites](#prerequisites-2)
      - [Installation Steps](#installation-steps)
        - [Navigate to frontend directory](#navigate-to-frontend-directory)
        - [Install Dependencies](#install-dependencies)
        - [Environment Configuration](#environment-configuration)
        - [Start Development Server](#start-development-server)
      - [Development Workflow](#development-workflow)
        - [Running the App](#running-the-app)
        - [Connecting to Backend](#connecting-to-backend)
      - [Project Structure Overview](#project-structure-overview)
      - [Common Issues](#common-issues)
        - [CORS Errors](#cors-errors)
        - [API Connection Failed](#api-connection-failed)
        - [Build Errors](#build-errors)
  - [Available Admin Features](#available-admin-features)

## Setup

### 1. Backend Setup

#### Option 1: Running with Docker (Recommended)

Docker Compose provides the most stable environment by containerizing the API, Worker, Database, Redis, Redis Insight and PGAdmin into a single network.

##### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed and running.
- WSL2 enabled (if on Windows).

##### Steps

1.  **Configure Environment**:
    Create a `.env` file in the root directory (using `.env.example` as a template).

    ```bash
    # Linux/Mac
    cp .env.example .env

    # Windows (PowerShell)
    Copy-Item .env.example .env
    ```
    - **Ollama Settings**:
      - `OLLAMA_URL`: URL for the Ollama instance (defaults to `"https://ollama.com/"`).
      - `OLLAMA_MODEL`: Model name (defaults to `gpt-oss:120b-cloud`).
      - `OLLAMA_API_KEY`: Get your Ollama cloud API key from [https://ollama.com/settings/keys](https://ollama.com/settings/keys).

2.  **Start Services**:
    From the project root, run:

    ```bash
    docker-compose up --build
    ```

3.  **Access Services**:
    - **API**: [http://localhost:8000/docs](http://localhost:8000/docs) (Root at [http://localhost:8000](http://localhost:8000))
    - **PGAdmin**: [http://localhost:5050](http://localhost:5050) (Login with credentials in `.env`)
    - **Redis**: [http://localhost:6379](http://localhost:6379)
    - **Redis Insight**: [http://localhost:5540](http://localhost:5540)
    - **Phoenix Observability (LLM Tracing)**: [http://localhost:6006](http://localhost:6006)

4.  **Stopping services**:
    ```bash
    docker-compose down
    ```

---

#### Option 2: Running Without Docker (Local Development)

Ideal for active development with faster hot-reloading and direct integration with local tools.

##### Prerequisites

- **Python 3.14+**
- **[uv](https://astral.sh/uv/)** (Fast Python package manager)
  - Windows: `irm https://astral.sh/uv/install.ps1 | iex`
  - macOS/Linux: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- **PostgreSQL 16+** with **[pgvector](https://github.com/pgvector/pgvector)** extension.
- **Redis 7+** (For caching and Celery broker).

##### Steps

1. **Set Up the GitHub Evaluator Package**:
   - Place/clone the `github-evaluation-package` folder directly inside the `hirego` root directory (the same folder containing `pyproject.toml`).
   - Ensure the path is set to relative `./github-evaluation-package` in `pyproject.toml` under `[tool.uv.sources]`.

2. **Install Dependencies**:
   ```bash
   uv sync
   ```

3. **Configure Environment**:
   Create a `.env` file in the root directory (using `.env.example` as a template).
   ```bash
   # Linux/Mac
   cp .env.example .env

   # Windows (PowerShell)
   Copy-Item .env.example .env
   ```
   _Ensure the following are correctly configured:_

   - `POSTGRES_SERVER`
   - `POSTGRES_USER` / `POSTGRES_PASSWORD`
   - `POSTGRES_DB` (e.g., `app`)
   - `REDIS_URL` (e.g., `redis://localhost:6379/0`)
   - **Ollama Settings**:
     - `OLLAMA_URL`: URL for the Ollama instance (defaults to `"https://ollama.com/"`).
     - `OLLAMA_MODEL`: Model name (defaults to `gpt-oss:120b-cloud`).
     - `OLLAMA_API_KEY`: Get your Ollama cloud API key from [https://ollama.com/settings/keys](https://ollama.com/settings/keys).
   - **GitHub Evaluator Specific Settings**:
     - `EVALUATOR_POSTGRES_DB` (e.g., `github_evalutor` — must be different from `POSTGRES_DB` to prevent table name conflicts).
     - `OPENAI_API_KEY` (or the respective LLM configurations).

4. **Database Initialization**:
   - Create the main database named `app` (or as specified in your `.env` under `POSTGRES_DB`).
   - Create the evaluator database named `github_evalutor` (or as specified in your `.env` under `EVALUATOR_POSTGRES_DB`).
   - Enable the **pgvector** extension on the main database using the provided script:
     ```bash
     psql -d app -f setup_extensions.sql
     ```
     _Note: This is required._

4. **Running the Application**:
   You need to run two processes in separate terminals:

   **Terminal 1: Celery Worker**
   Required for heavy background tasks like resume parsing and LLM analysis.
   ```bash
   uv run celery -A app.v1.core.celery_app worker --loglevel=info --pool=solo
   ```

   **Terminal 2: FastAPI Server**
   ```bash
   uv run uvicorn --app-dir backend app.main:app --reload
   # or uv run uvicorn --app-dir backend app.main:app --reload --reload-dir backend/app
   ```

---

### Project Structure

```text
.
└── app/
    ├── main.py                      # FastAPI entry point & lifespan events
    └── v1/
        ├── api/
        │   └── main.py              # Top-level router composition
        ├── core/                    # Celery application, global cache, config, logging, middleware, LLM/heuristic analyzers
        ├── db/
        │   ├── models/              # SQLAlchemy domain models (User, Candidates, Jobs, etc.)
        │   └── base.py /
        ├── dependencies/            # Auth and permissions dependencies
        ├── prompts/                 # LLM integration prompts
        ├── repository/              # Data access logic (CRUD)
        ├── routes/                  # API route handlers (Controllers)
        ├── schemas/                 # Pydantic data validation schemas
        ├── services/                # Business logic & Celery background tasks
        └── utils/                   # Parser, text processor, resume uploader and other utility helper functions
```

---

### Notes

- **Automatic Tables**: The application uses `Base.metadata.create_all` in `app/main.py`. Tables are automatically created on startup if they do not exist.
- **Passwords**: Hashed via bcrypt before storage.
- **Worker Configuration**: The `--pool=solo` flag is mandatory for Celery when running on Windows.
- **Database URI**: If preferred, `SQLALCHEMY_DATABASE_URI` can be set directly in `.env`.

### Verification

After startup, verify the backend is running correctly:

- **Root Endpoint**: [http://localhost:8000/](http://localhost:8000/)
- **Swagger Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Alternative Redoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Phoenix Observability**: [http://localhost:6006/](http://localhost:6006/)

### 2. Frontend Setup Guide

#### Prerequisites

Ensure you have the following installed:

- **Node.js** 22 or higher (or **Bun**)
- **npm** (comes with Node.js) or **Bun**
- **Backend API** running at `http://localhost:8000`

#### Installation Steps

##### Navigate to frontend directory

```bash
cd frontend
```

##### Install Dependencies

```bash
# Using npm
npm install

# Using bun
bun install
```

This will install all required packages defined in `package.json`.

##### Environment Configuration

```env
VITE_API_URL=http://localhost:8000/api/v1
VITE_RESUME_MAX_SIZE_MB=5
VITE_ADMIN_API_ENDPOINT="/admin"
```

##### Start Development Server

```bash
# Using npm
npm run dev

# Using bun
bun run dev
```

The application will be available at `http://localhost:5173`.

#### Development Workflow

##### Running the App

```bash
# Development server with hot reload
npm run dev      # or bun run dev

# Build for production
npm run build    # or bun run build

# Preview production build
npm run preview  # or bun run preview

# Run linter
npm run lint     # or bun run lint
```

##### Connecting to Backend

The frontend expects the backend API to be running. If the backend is on a different port or host, update `VITE_API_URL` in your `.env` file.

#### Project Structure Overview

```text
src/
├── apis/           # API calls and client configuration
│   └── admin/      # Admin-specific API endpoints
├── assets/         # Static assets (images, icons, etc.)
├── components/     # Reusable UI components
│   ├── admin/      # Admin-specific UI elements
│   ├── auth/       # Authentication components
│   ├── candidate/  # Candidate profile and management components
│   ├── job/        # Job-related components
│   ├── job-board/  # Kanban board components for recruitment pipelines
│   ├── job-form/   # Form components for job creation and modification
│   ├── layout/     # Page layout structures (Sidebar, Header, etc.)
│   ├── logo/       # App logo components
│   ├── modal/      # Modal dialogs for CRUD operations
│   ├── shared/     # Shared layout components
│   └── ui/         # Base UI primitives (buttons, inputs, badges, etc.)
├── constants/      # App constants and static data configs
├── hooks/          # Custom React hooks
├── lib/            # Third-party library configs and utilities (e.g., shadcn helper)
├── pages/          # Page components
│   ├── Admin/      # Admin dashboards and management pages
│   ├── Auth/       # Authentication page views (Login, Register)
│   └── dashboard/  # Candidate tracking, statistics, and job board pages
├── routes/         # Route definitions and protection
├── schemas/        # Zod validation schemas
├── store/          # Redux state management
├── styles/         # Global and component stylesheets (Tailwind + CSS)
├── types/          # TypeScript type definitions
└── utils/          # Utility helper functions
```

#### Common Issues

##### CORS Errors

If you encounter CORS errors, ensure the backend allows requests from `http://localhost:5173` or update the backend CORS configuration.

##### API Connection Failed

- Verify the backend is running
- Check `VITE_API_URL` in `.env`
- Ensure the backend URL is accessible

##### Build Errors

```bash
# Using npm
rm -rf node_modules package-lock.json
npm install

# Windows Powershell
Remove-Item -Recurse -Force node_modules, package-lock.json

# Using bun
rm -rf node_modules bun.lock
bun install

# Windows Powershell
Remove-Item -Recurse -Force node_modules, bun.lock
```

## Available Admin Features

Once logged in as an admin, you can access:

- **Dashboard** - Overview statistics and metrics
- **Users** - Manage system users
- **Jobs** - Create and manage job postings
- **Skills** - Manage candidate skills
- **Roles** - Configure user roles and permissions
- **Audit Logs** - View system activity logs
- **Candidate Search** - Search across all candidates
- **Recent Uploads** - View recently uploaded resumes

- and many more
