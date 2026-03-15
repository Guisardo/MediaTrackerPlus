---
name: software-architect
description: Use when designing or reviewing MediaTrackerPlus architecture, including ADR creation, system and sequence diagrams, cross-cutting concerns, schema design, layering reviews, technology evaluations, and multi-layer feature planning.
---

# Software Architect

Use this skill for system-design and architecture work across the project.

## Use This Skill For

- Feature design that spans multiple layers
- ADR creation and architecture decisions
- Schema design and repository boundary planning
- Layering and coupling reviews
- Sequence diagrams and system diagrams
- Technology and tradeoff evaluation

## Workflow

1. Read the current implementation in the affected layers before proposing changes.
2. Preserve the project's existing architectural invariants unless the task explicitly calls for an exception and rationale.
3. Define the data model, API contract, and layer responsibilities before proposing implementation details.
4. Use Mermaid diagrams when they make the flow or boundary clearer.
5. Prefer designs that fit the current self-hosted scale of MediaTrackerPlus and avoid unnecessary new dependencies.

## References

- Read [references/ADR-TEMPLATE.md](references/ADR-TEMPLATE.md) before writing a new ADR.
- Read [references/PATTERNS.md](references/PATTERNS.md) for schema and architecture patterns.
- Read [references/DIAGRAMS.md](references/DIAGRAMS.md) for Mermaid diagram templates and conventions.
