# Auth Package

The Auth Package is a centralized, standalone authentication and identity service designed to be reused across multiple applications.

It provides secure authentication, session management, organization-scoped identity, audit logging, and compliance-ready foundations.

## What This Service Does
- Email/password authentication
- OAuth authentication (Google, Zoho)
- Redis-backed session management
- Organization-scoped identity
- Audit logging
- Policy enforcement

## What This Service Does NOT Do
- Application-specific authorization logic
- UI or frontend rendering
- Multi-organization user identities
- Enterprise SAML / MFA (future)

## Integration Model
Applications authenticate users via this service and trust:
- JWT access tokens
- Server-side session validation

Applications must NOT:
- Store passwords
- Implement custom auth logic
- Override org policies

## Local Development
- Python 3.14+
- PostgreSQL
- Redis

```bash\
uvicorn app.main:app --reload\
