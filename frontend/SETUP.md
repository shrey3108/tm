# Setup Guide

This guide covers the complete setup process for the HR Platform Frontend.

## Prerequisites

Ensure you have the following installed:

- **Node.js** 18 or higher (or **Bun**)
- **npm** (comes with Node.js) or **Bun**
- **Backend API** running at `http://localhost:8000`

## Installation Steps

### 1. Clone and Navigate

```bash
cd frontend
```

### 2. Install Dependencies

```bash
# Using npm
npm install

# Using bun
bun install
```

This will install all required packages defined in `package.json`.

### 3. Environment Configuration

Copy the example environment file:

```bash
# Linux/Mac
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

Edit `.env` to configure the API URL:

```env
VITE_API_URL=http://localhost:8000/api/v1
```

### 4. Start Development Server

```bash
# Using npm
npm run dev

# Using bun
bun dev
```

The application will be available at `http://localhost:5173`.

## Development Workflow

### Running the App

```bash
# Development server with hot reload
npm run dev      # or bun dev

# Build for production
npm run build    # or bun run build

# Preview production build
npm run preview  # or bun run preview

# Run linter
npm run lint     # or bun run lint
```

### Connecting to Backend

The frontend expects the backend API to be running. If the backend is on a different port or host, update `VITE_API_URL` in your `.env` file.

## Project Structure Overview

```
src/
├── apis/           # API calls and client configuration
├── assets/         # Static assets (images, icons, etc.)
├── components/     # Reusable UI components
│   ├── auth/      # Authentication components
│   ├── common/    # Shared components (Button, Card, Input, etc.)
│   └── modal/     # Modal dialogs for CRUD operations
├── constants/      # App constants and static data configs
├── hooks/         # Custom React hooks
├── lib/           # Third-party library configs and utilities (e.g., shadcn helper)
├── pages/         # Page components
│   └── Admin/     # Admin dashboard and management pages
├── routes/        # Route definitions
├── schemas/       # Zod validation schemas
├── store/         # Redux state management
├── styles/        # Global and component stylesheets (Tailwind + CSS)
├── types/         # TypeScript type definitions
└── utils/         # Utility helper functions
```

## Common Issues

### CORS Errors

If you encounter CORS errors, ensure the backend allows requests from `http://localhost:5173` or update the backend CORS configuration.

### API Connection Failed

- Verify the backend is running
- Check `VITE_API_URL` in `.env`
- Ensure the backend URL is accessible

### Build Errors

```bash
# Using npm
rm -rf node_modules package-lock.json
npm install

# Using bun
rm -rf node_modules bun.lock
bun install
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
