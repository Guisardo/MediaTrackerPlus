---
name: backend-developer
description: Use when creating or modifying MediaTrackerPlus backend code in server/, including Express controllers, Knex repositories, database migrations, authentication, metadata providers, notifications, queries, and backend tests.
---

# Backend Developer

Use this skill for server-side work in `server/`.

## Use This Skill For

- API endpoints and controller changes
- Repository and query changes
- Knex migrations and entity updates
- Authentication and session logic
- Metadata-provider integrations
- Backend bug fixes and tests

## Workflow

1. Read the affected controller, repository, entity, and migration files before editing.
2. Preserve the controller -> repository -> database layering. Controllers should not write SQL, and repositories should not take on HTTP responsibilities.
3. Add new migrations for schema changes instead of editing old ones.
4. Use existing error-handling and auth patterns, including `RequestError` and current middleware boundaries.
5. Prefer existing repository and provider abstractions over introducing parallel logic paths.
6. Update or add focused tests when behavior changes.

## References

- Read [references/API.md](references/API.md) for endpoint conventions and backend structure.
- Read [references/TESTING.md](references/TESTING.md) for test patterns, migration testing, and backend validation workflows.
