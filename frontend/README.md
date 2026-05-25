# HR Platform Frontend

A React-based frontend for the HR Platform with authentication, job management, candidate tracking, resume parsing, and comprehensive admin features.

## Features

- **React 19** - Latest React with hooks
- **TypeScript** - Type-safe development
- **Vite 8** - Fast build tool and dev server
- **React Router v7** - Client-side routing
- **Redux Toolkit** - State management
- **Tailwind CSS v4 & Shadcn UI** - Utility-first styling and accessible component library
- **React Hook Form + Zod** - Form handling and validation
- **Axios** - HTTP client for API calls
- **Role-based Access Control** - Admin, HR Manager, Recruiter roles
- **Data Tables** - Sortable, searchable admin data tables with TanStack Table
- **Modal Forms** - Create/edit resources with validation
- **Resume Parsing** - Upload and parse candidate resumes
- **Candidate Search** - Advanced search functionality
- **Audit Logs** - Track system activities
- **Analytics Dashboard** - Overview metrics and statistics

## Prerequisites

- Node.js 18+
- npm or bun
- Backend API running at `http://localhost:8000`

## Quick Start

```bash
# Install dependencies
npm install
# or: bun install

# Configure environment
cp .env.example .env

# Start development server
npm run dev
# or: bun dev
```

The app will be available at `http://localhost:5173`.

## Available Scripts
- All commands can also be run using bun.

| Script            | Description              |
| ----------------- | ------------------------ |
| `npm run dev`     | Start development server |
| `npm run build`   | Build for production     |
| `npm run lint`    | Run ESLint               |
| `npm run preview` | Preview production build |


## Tech Stack

- **Frontend Framework**: React 19
- **Language**: TypeScript
- **Build Tool**: Vite 8
- **Routing**: React Router v7
- **State Management**: Redux Toolkit
- **UI Components**: Shadcn UI & Base UI
- **Forms**: React Hook Form + Zod
- **HTTP Client**: Axios
- **Styling**: Tailwind CSS v4 + CSS
