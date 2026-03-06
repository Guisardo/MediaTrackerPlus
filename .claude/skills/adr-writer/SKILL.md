---
name: adr-writer
description: Create, update, and maintain Architecture Decision Records (ADRs). Use when the user wants to document an architectural decision, record why a technology or pattern was chosen, supersede an old decision, or establish an ADR process for the project. Triggers: write an ADR, document this decision, architecture decision record, why did we choose X, record this trade-off.
context: fork
agent: software-architect
---

# ADR Writer — Architecture Decision Records

This skill produces well-structured, durable Architecture Decision Records that capture not just what was decided but why, ensuring future developers can understand and challenge decisions with full context.

## Quick Reference

| Goal | Reference |
|------|-----------|
| New decision to record | Use the MADR template in [TEMPLATES.md](TEMPLATES.md) |
| Supersede an existing ADR | Use the Supersede workflow below |
| Review team ADR examples | [EXAMPLES.md](EXAMPLES.md) |

## When to Write an ADR

Write an ADR whenever a decision:
- Is **hard to reverse** (data model, external API contract, runtime platform)
- Affects **multiple teams or components**
- Involves **significant trade-offs** between options
- Will be **questioned** by a new engineer in 6 months

Do NOT write an ADR for: minor implementation details, stylistic preferences with no trade-offs, or decisions that can be reversed in a PR.

## ADR Authoring Workflow

### Step 1 — Gather Context

Before writing, answer:

```
PROBLEM    What decision needs to be made, and why now?
DRIVERS    What forces are shaping this decision? (NFRs, constraints, deadlines)
OPTIONS    What alternatives were seriously considered?
CRITERIA   What criteria will the decision be evaluated against?
DECISION MAKERS  Who must approve or be consulted?
```

### Step 2 — Evaluate Options

For each option, assess it against every criterion.
Use a decision matrix when > 3 options exist:

```
| Criterion (weight) | Option A | Option B | Option C |
|--------------------|----------|----------|----------|
| Ops complexity (3) |    2     |    3     |    1     |
| Dev velocity (2)   |    3     |    2     |    2     |
| Cost (1)           |    3     |    1     |    2     |
| Weighted total     |   17     |   15     |   11     |
```

### Step 3 — Write the ADR

Use the template from [TEMPLATES.md](TEMPLATES.md).
Place the file at: `docs/adr/NNNN-<slug>.md`
Number sequentially from the last ADR in the project.

### Step 4 — Link and Cross-Reference

- Link the new ADR from any related existing ADRs
- Link from the CHANGELOG or architecture doc if appropriate
- If this supersedes an existing ADR, update the old one's status to "Superseded by ADR-NNNN"

## Supersede Workflow

When an old decision is being reversed or replaced:

1. Write the new ADR with status **"Proposed"**
2. In the new ADR's **Context** section, explicitly reference the old ADR and why circumstances have changed
3. Get the new ADR accepted/approved
4. Update the old ADR: set status to **"Superseded by [ADR-NNNN](NNNN-new-slug.md)"** — do NOT delete the old file
5. Add a note in the old ADR's body pointing to the new one

## ADR Lifecycle Statuses

| Status | Meaning |
|--------|---------|
| `Proposed` | Written, under review |
| `Accepted` | Approved and in effect |
| `Rejected` | Considered and declined; kept for record |
| `Deprecated` | No longer relevant but not superseded |
| `Superseded by ADR-NNNN` | Replaced by a newer decision |

## File Naming Convention

```
docs/adr/
├── 0001-use-postgresql-as-primary-database.md
├── 0002-adopt-hexagonal-architecture.md
├── 0003-replace-rest-with-graphql-for-client-api.md   ← supersedes 0001 example
└── README.md   ← index of all ADRs with one-line summaries
```

Always zero-pad to 4 digits.

## ADR Index README

Maintain `docs/adr/README.md` as a living index:

```markdown
# Architecture Decision Records

| # | Title | Status | Date |
|---|-------|--------|------|
| [0001](0001-...) | Use PostgreSQL as primary database | Accepted | 2024-01-15 |
| [0002](0002-...) | Adopt hexagonal architecture | Accepted | 2024-02-01 |
```

Update this index every time you add or change an ADR status.

## Quality Bar for an ADR

A good ADR must answer "yes" to all of these:

- [ ] The **problem statement** is specific enough that someone unfamiliar could understand what was at stake
- [ ] At least **two alternatives** are documented with genuine trade-off analysis
- [ ] The **decision rationale** references the stated drivers/criteria — not just "we prefer X"
- [ ] **Consequences** include at least one negative consequence acknowledged honestly
- [ ] **Status** is set and reflects the current state
- [ ] Future engineers can tell **when** to re-evaluate this decision ("revisit if we exceed 10k req/s")
