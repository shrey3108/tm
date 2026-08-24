# Contributing to Auth Package

## Before Writing Code

- Read `docs/AUTH_GUARDRAILS.md`
- Read `docs/FUNCTIONAL.md`
- Read `docs/NON_FUNCTIONAL.md`
- Read `docs/CODE_GENERATION_GUARDRAILS.md`

## Code Rules

- Respect folder ownership
- No business logic in routes
- No database access outside repositories
- All inputs and outputs must use Pydantic models
- One active session per user

## AI Usage

- Always use system prompts from `docs/prompts`
- Do not generate code without applying guardrails
- If unsure, stop and ask for clarification

## Pull Requests

- Must pass pre-commit checks
- Must include tests
- Must not introduce new folders
