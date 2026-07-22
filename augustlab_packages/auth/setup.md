# AugustLab Auth Service - Setup Guide

Complete setup instructions for installing and running the AugustLab Auth Service on a new machine.

---

## Prerequisites

### Required Software

- **Python 3.11+** - [Download Python](https://www.python.org/downloads/)
- **UV** (Python package manager) - [UV Documentation](https://github.com/astral-sh/uv)
- **PostgreSQL 14+** - [Download PostgreSQL](https://www.postgresql.org/download/)
- **Git** - [Download Git](https://git-scm.com/downloads/)
- **GitLab Account** - Access to the repository

### System Requirements

- **OS:** Linux, macOS, or Windows (with WSL2 recommended)
- **RAM:** Minimum 4GB
- **Disk Space:** 2GB free space

---

## Installation

### Step 1: Install UV

UV is a fast Python package installer and resolver.

**Linux/macOS:**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

**Windows (PowerShell):**
```powershell
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**Verify Installation:**
```bash
uv --version
```

### Step 2: Clone the Repository

```bash

git clone https://gitlab.com/augustinfotech/august-packages.git

# Navigate to project directory
cd augustlab-packages
```

### Step 3: Create Virtual Environment with UV

```bash
# Create virtual environment with Python 3.11+
uv venv

# Activate virtual environment
# Linux/macOS:
source .venv/bin/activate

# Windows:
.venv\Scripts\activate
```

### Step 4: Install Dependencies

```bash
# Install all dependencies using UV
uv pip install -r requirements.txt

# Or if you have pyproject.toml
uv pip install -e .
```

**Expected Dependencies:**
- FastAPI
- FastAPI-Users
- SQLAlchemy
- asyncpg (PostgreSQL driver)
- Alembic (database migrations)
- python-jose (JWT)
- passlib (password hashing)
- httpx (OAuth HTTP client)
- slowapi (rate limiting)
- python-multipart
- uvicorn

---

## Configuration

### Step 1: Create Environment File

```bash
# Copy example environment file
cp .env.example .env

# Or create new .env file
touch .env
```

### Step 2: Configure Environment Variables

Edit `.env` file with your settings:

```bash
# ============================================================================
# Application Settings
# ============================================================================
APP_NAME=AugustLab Auth
APP_VERSION=1.0.0
APP_ENV=development  # development | staging | production
DEBUG=True

# ============================================================================
# Database Configuration
# ============================================================================
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/augustlab_auth
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10

# ============================================================================
# Security Settings
# ============================================================================
SECRET_KEY=your-secret-key-here-min-32-characters-long-please-change-this
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# ============================================================================
# CORS Settings
# ============================================================================
CORS_ORIGINS=http://localhost:3000,http://localhost:8000
CORS_ALLOW_CREDENTIALS=True

# ============================================================================
# Google OAuth
# ============================================================================
AUTH_ENABLE_GOOGLE=true
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/v1/oauth/google/callback

# ============================================================================
# Zoho OAuth
# ============================================================================
AUTH_ENABLE_ZOHO=true
ZOHO_CLIENT_ID=your-zoho-client-id
ZOHO_CLIENT_SECRET=your-zoho-client-secret
ZOHO_REDIRECT_URI=http://localhost:8000/v1/oauth/zoho/callback
ZOHO_DOMAIN=https://accounts.zoho.com

# ============================================================================
# Custom Login
# ============================================================================
AUTH_ENABLE_CUSTOM_LOGIN=true

# ============================================================================
# Rate Limiting
# ============================================================================
RATE_LIMIT_LOGIN=5/minute
RATE_LIMIT_OAUTH=5/minute
RATE_LIMIT_REGISTER=3/minute

# ============================================================================
# Redis Configuration (Optional - for session storage)
# ============================================================================
REDIS_URL=redis://localhost:6379/0

# ============================================================================
# Logging
# ============================================================================
LOG_LEVEL=INFO  # DEBUG | INFO | WARNING | ERROR
LOG_FILE=logs/app.log
```

### Step 3: Generate Secret Key

```bash
# Generate a secure secret key
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Copy the output and paste it as SECRET_KEY in .env
```

---

## Database Setup

### Step 1: Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

**macOS (with Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Windows:**
Download and install from [PostgreSQL Downloads](https://www.postgresql.org/download/windows/)

### Step 2: Create Database

```bash
# Login to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE augustlab_auth;
CREATE USER augustlab_user WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE augustlab_auth TO augustlab_user;

# Exit
\q
```

### Step 3: Verify Database Connection

```bash
# Test connection
psql -h localhost -U augustlab_user -d augustlab_auth

# If successful, you'll see the PostgreSQL prompt
augustlab_auth=>
```

### Step 4: Run Database Migrations

The application uses Alembic for database migrations.

```bash
# Initialize Alembic (only if not already initialized)
alembic init alembic

# Create initial migration
alembic revision --autogenerate -m "Initial migration"

# Run migrations
alembic upgrade head
```

**Note:** The application also auto-creates tables on startup via the `lifespan` function in `main.py`.

---

## Running the Application

### Development Mode

```bash
# Run with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Or with custom settings
uvicorn main:app --reload --host 0.0.0.0 --port 8000 --log-level debug
```

### Using UV Run

```bash
# Run with UV
uv run uvicorn main:app --reload
```

### Verify Application is Running

```bash
# Health check
curl http://localhost:8000/health

# Expected response:
# {"status": "healthy"}

# API documentation
open http://localhost:8000/docs
```

---

## OAuth Provider Setup

### Google OAuth Setup

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/

2. **Create New Project**
   - Click "Select a project" � "New Project"
   - Name: "AugustLab Auth"
   - Click "Create"

3. **Enable Google+ API**
   - Navigate to "APIs & Services" � "Library"
   - Search for "Google+ API"
   - Click "Enable"

4. **Create OAuth Credentials**
   - Go to "APIs & Services" � "Credentials"
   - Click "Create Credentials" � "OAuth client ID"
   - Application type: "Web application"
   - Name: "AugustLab Auth Web Client"
   
5. **Configure Authorized Redirect URIs**
   ```
   http://localhost:8000/v1/oauth/google/callback
   https://yourdomain.com/v1/oauth/google/callback
   ```

6. **Copy Credentials**
   - Copy "Client ID" � Paste as `GOOGLE_CLIENT_ID` in `.env`
   - Copy "Client Secret" � Paste as `GOOGLE_CLIENT_SECRET` in `.env`

### Zoho OAuth Setup

1. **Go to Zoho API Console**
   - Visit: https://api-console.zoho.com/

2. **Create Client**
   - Click "Add Client"
   - Client Type: "Server-based Applications"
   - Client Name: "AugustLab Auth"
   - Homepage URL: `http://localhost:8000`
   - Authorized Redirect URIs: `http://localhost:8000/v1/oauth/zoho/callback`

3. **Copy Credentials**
   - Copy "Client ID" � Paste as `ZOHO_CLIENT_ID` in `.env`
   - Copy "Client Secret" � Paste as `ZOHO_CLIENT_SECRET` in `.env`

4. **Set Domain**
   - For US datacenter: `https://accounts.zoho.com`
   - For EU datacenter: `https://accounts.zoho.eu`
   - For India datacenter: `https://accounts.zoho.in`

---

### Common Issues

#### 1. Database Connection Error

**Error:**
```
sqlalchemy.exc.OperationalError: could not connect to server
```

**Solution:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql

# Verify connection string in .env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/dbname
```

#### 2. OAuth Redirect URI Mismatch

**Error:**
```
redirect_uri_mismatch
```

**Solution:**
- Verify redirect URI in OAuth provider console matches exactly
- Check `.env` file has correct `GOOGLE_REDIRECT_URI` or `ZOHO_REDIRECT_URI`
- Ensure no trailing slashes

#### 3. CSRF Token Invalid

**Error:**
```
{"detail": "Invalid state token format"}
```

**Solution:**
- Clear browser cookies
- Ensure using the fixed OAuth files
- Check state parameter format: `email:csrf_token`

#### 4. Module Not Found

**Error:**
```
ModuleNotFoundError: No module named 'xyz'
```

**Solution:**
```bash
# Reinstall dependencies
uv pip install -r requirements.txt

# Verify virtual environment is activated
which python  # Should show .venv/bin/python
```

#### 5. Port Already in Use

**Error:**
```
OSError: [Errno 48] Address already in use
```

**Solution:**
```bash
# Find process using port 8000
lsof -i :8000

# Kill the process
kill -9 <PID>

# Or use different port
uvicorn main:app --reload --port 8001
```

---

## Development Workflow

### GitLab Workflow

#### 1. Clone and Setup

```bash
# Clone repository
git clone https://gitlab.com/augustinfotech/august-packages.git
cd augustlab-oackages

# Create feature branch
git checkout -b feature/your-feature-name
```

#### 2. Make Changes

```bash
# Make your changes
# ...

# Check status
git status

# Stage changes
git add .

# Commit with descriptive message
git commit -m "feat: add new OAuth provider support"
```

#### 3. Push to GitLab

```bash
# Push feature branch
git push origin feature/your-feature-name
```

#### 4. Create Merge Request

- Go to GitLab repository
- Click "Create merge request"
- Fill in description
- Assign reviewers
- Submit for review

### Code Quality

```bash
# Format code
uv pip install black isort
black .
isort .

# Lint code
uv pip install flake8
flake8 v1/

# Type checking
uv pip install mypy
mypy v1/
```

### Development

```bash
APP_ENV=development
DEBUG=True
LOG_LEVEL=DEBUG
CORS_ORIGINS=http://localhost:3000,http://localhost:8000
```

### Staging

```bash
APP_ENV=staging
DEBUG=False
LOG_LEVEL=INFO
CORS_ORIGINS=https://staging.yourdomain.com
DATABASE_URL=postgresql+asyncpg://user:pass@staging-db:5432/db
```

### Production

```bash
APP_ENV=production
DEBUG=False
LOG_LEVEL=WARNING
CORS_ORIGINS=https://yourdomain.com
DATABASE_URL=postgresql+asyncpg://user:pass@prod-db:5432/db
SECRET_KEY=<very-long-random-secret-key>
```

---

## Monitoring and Logging

### Log Files

```bash
# View logs
tail -f logs/app.log

# Search logs
grep "ERROR" logs/app.log

# Rotate logs (logrotate)
sudo nano /etc/logrotate.d/augustlab-auth
```

### Health Monitoring

```bash
# Simple uptime monitor
curl http://localhost:8000/health

# Or use monitoring tools like:
# - Prometheus
# - Grafana
# - New Relic
# - DataDog
```

---

### .gitlab-ci.yml Example

```yaml
stages:
  - test
  - build
  - deploy

variables:
  PYTHON_VERSION: "3.11"

test:
  stage: test
  image: python:3.11
  before_script:
    - pip install uv
    - uv venv
    - source .venv/bin/activate
    - uv pip install -r requirements.txt
  script:
    - pytest
    - flake8 v1/
  only:
    - merge_requests
    - main

build:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t augustlab-auth:$CI_COMMIT_SHA .
    - docker tag augustlab-auth:$CI_COMMIT_SHA augustlab-auth:latest
  only:
    - main

deploy_staging:
  stage: deploy
  script:
    - ssh user@staging-server "cd /opt/augustlab-auth && git pull && systemctl restart augustlab-auth"
  only:
    - develop

deploy_production:
  stage: deploy
  script:
    - ssh user@prod-server "cd /opt/augustlab-auth && git pull && systemctl restart augustlab-auth"
  only:
    - main
  when: manual
```

---

## Quick Reference Commands

```bash
# Setup
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt

# Run
uvicorn main:app --reload

# Test
pytest

# Database
alembic upgrade head
alembic revision --autogenerate -m "message"

# Docker
docker-compose up -d
docker-compose logs -f
docker-compose down

# Git
git checkout -b feature/name
git add .
git commit -m "message"
git push origin feature/name
```

---

## Support

### Documentation

- **API Docs:** http://localhost:8000/docs

