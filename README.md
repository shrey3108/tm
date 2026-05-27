# HR hiring-platform

An AI-powered interview evaluation and screening platform that automates candidate matching, transcribes multi-round interviews, and evaluates soft & technical skills using an LLM-as-a-Judge architecture.

---

##  Features & Workflow

The platform tracks candidates through **4 main stages** (which can be dynamically adjusted depending on the job description):

1. **Resume Screening (AI Pre-Filter)**: Auto-parses resumes (PDF/DOCX) and compares them with the Job Description (JD) to generate a match percentage and skill-gap analysis.
2. **Stage 1 – HR Screening**: Evaluates communication, confidence, and cultural fit from uploaded screening recordings.
<!-- 3. **Stage 2 – Technical Practical**: Examines real-time technical skills, problem-solving, and implementation from coding test repo and project requirement . -->
<!-- 4. **Stage 3 – Panel Evaluation**: Conducts a final technical + behavioral assessment to produce overall attribute-wise scores and hiring recommendations. -->

---

##  Dynamic Stage & Criteria Configuration

The platform defines a standard workflow but supports full dynamic adjustment of interview stages and evaluation criteria based on the job designation, experience requirements, and Job Description (JD) complexity:
- **Flexible Stages**: Stages can be added, removed, or customized using predefined templates.
- **LLM-as-a-Judge Criteria**: Each stage evaluates specific candidate attributes using LLM-as-a-judge context scoring.

---

## User Roles & Permissions
- The platform supports Role-Based Access Control (RBAC) with user roles.
---

##  Tech Stack & Dependencies

### Backend 
- **Web Framework**: **FastAPI** (modern, async API backend)
- **Database & ORM**: **PostgreSQL** with `pgvector` (vector extension), **SQLAlchemy 2.0** (async database connection), and **FastCRUD**
- **Task Queue & Caching**: **Celery** with **Redis** (asynchronous processing for file analysis and speech-to-text)
- **AI & LLM Integration**:
  - **DSPy** (structured prompt programming and optimization)
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
