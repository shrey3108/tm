# HR hiring-platform

An AI-powered interview evaluation and screening platform that automates candidate matching, transcribes multi-round interviews, and evaluates soft & technical skills using an LLM-as-a-Judge architecture.

---

## Features & Capabilities

### 1. Recruitment Pipeline & Candidate Management
- **Resume Screening (AI Pre-Filter)**: Auto-parses resumes (PDF/DOCX) and compares them with the Job Description (JD) to generate a match percentage and skill-gap analysis.
- **Stage 1 – HR Screening**: Evaluates communication, confidence, and cultural fit from uploaded screening transcript.
<!-- - **Stage 2 – Technical Practical**: Examines real-time technical skills, problem-solving, and implementation from coding test repo and project requirement . -->
<!-- - **Stage 3 – Panel Evaluation**: Conducts a final technical + behavioral assessment to produce overall attribute-wise scores and hiring recommendations. -->

- **Global & Job-Specific Views**:
  - **Job Candidates View**: Browse candidates associated with a specific job and upload resume .
  - **All Candidates View**: Centralized candidate search across the all the job.

### 2. Comprehensive Admin Features & Management (CRUD)
- **Admin Dashboard**: Visual overview of platform-wide metrics.
- **Core Entities Management**:
  - **Jobs Positions (CRUD)**: Create, read, update, and delete job postings and their respective criteria.
  - **Job Stages & Criteria (CRUD)**: Dynamically customize the stages per job.
  - **Skills & Departments (CRUD)**: Manage the skills and departments.
  - **Priorities (CRUD)**: Set the deadline for candidate hiring.
- **Read-Only System Configuration**:
  - **Prompts (Read-Only)**: Review active LLM templates and system prompt instructions used by the evaluation engine.
- **Cache Management**:
  - **Clear Cache (Admin Only)**: Clear Redis memory cache.

---

## User Roles & Access Control

The platform implements Role-Based Access Control (RBAC) to enforce security and clean separation of duties:
- **HR User**: Accesses recruitment pipelines, uploads candidate resumes/transcripts, views screening recommendations, and updates candidate progression.
- **Admin User**: Accesses the full admin panel (managing jobs, stages, criteria, skills, departments, priorities), clears system caches, and manages users.
- **Security & Logs (Read-Only)**: Secure audit logs showing system activity, user actions, and security events for tracking and compliance.

---

##  Tech Stack & Dependencies

### Backend 
- **Web Framework**: **FastAPI** (modern, async API backend)
- **Database & ORM**: **PostgreSQL** with `pgvector` (vector extension), **SQLAlchemy 2.0** (async database connection), and **FastCRUD**
- **Task Queue & Caching**: **Celery** with **Redis** (asynchronous processing for file analysis and speech-to-text)
- **AI & LLM Integration**:
  - **AutoGen** & **OpenAI API** compatibility (for agentic workflows)
  - **Sentence Transformers** (local text embedding generation)
  - **PyMuPDF**, **docx2txt**, **langextract**, **markitdown** (document parsing and extraction)
- **Observability**: **Arize Phoenix** (tracing LLM inputs/outputs via OpenTelemetry SDK)
- **Authentication**: **JWT** (`pyjwt`) and password hashing via **Bcrypt**


### Frontend 
- **Core Library**: **React 19** with **TypeScript** & **Vite** (fast HMR dev server)
- **State Management**: **Redux Toolkit** (`@reduxjs/toolkit` and `react-redux`)
- **Styling & UI Components**:
  - **Tailwind CSS v4** (via `@tailwindcss/vite`)
  - **Base UI** (`@base-ui/react`) & **Shadcn** components
  - **Lucide React** for modern iconography
- **Forms & Validation**: **React Hook Form** with **Zod** schema validations
- **Charts & Data**: **Recharts** (interactive data visualization)
- **HTTP Client**: **Axios** (for backend API communications)

---

For detailed setup, local database initialization, and running frontend/backend development servers, please refer to the **[SETUP.md](SETUP.md)** file.
