---
name: system-design
description: Design, document, and review software system architectures. Use when the user asks to design a system, create architecture diagrams, plan components or services, evaluate scalability, choose between architectural patterns (microservices, monolith, event-driven, CQRS, hexagonal), or review an existing architecture for quality or fitness.
context: fork
agent: software-architect
---

# System Design — Architecture Design & Review

This skill guides Claude through producing rigorous, documented system architectures: from initial decomposition through diagrams, pattern selection, and quality validation.

## Quick Reference

| Goal | Reference | Action |
|------|-----------|--------|
| Draw component/sequence/data-flow diagrams | [DIAGRAMS.md](DIAGRAMS.md) | Produce Mermaid source |
| Choose or evaluate an architectural pattern | [PATTERNS.md](PATTERNS.md) | Compare trade-offs |
| Gate a design before sign-off | [QUALITY-CHECKLIST.md](QUALITY-CHECKLIST.md) | Run checklist |

## Design Workflow

### Step 1 — Understand the Problem

Before drawing anything, extract these constraints:

```
FUNCTIONAL   What does the system do? (key user stories / APIs)
NON-FUNCTIONAL  Latency SLO? Availability target? Peak QPS? Data volume?
BOUNDARIES   What is inside vs. outside scope?
CONSTRAINTS  Language/runtime mandates, existing services to integrate, budget
FAILURE MODE What must never go wrong?
```

Ask the user clarifying questions for any unknown dimension. Never design in ambiguity.

### Step 2 — Decompose into Domains

Apply domain-driven thinking:

1. Identify **bounded contexts** (cohesive business capabilities)
2. Map each context to a candidate component/service
3. Define the **public contract** of each component (inputs, outputs, events)
4. Draw the initial **context map** (see [DIAGRAMS.md](DIAGRAMS.md) → Context Diagram)

Rule: a component should be ownable by a single team without coordinating outside its boundary for day-to-day changes.

### Step 3 — Select Architectural Style

Read [PATTERNS.md](PATTERNS.md) and select the style that best fits:

- Qualify your choice with the non-functional requirements from Step 1
- Document the **rejected alternatives** and the reason for rejection (feeds the ADR)
- Note the main **risks** the chosen pattern introduces

### Step 4 — Design Data Flow

For each significant user journey:

1. Trace the request path end-to-end
2. Identify **synchronous vs. asynchronous** boundaries
3. Note data stores and their **consistency model** (strong / eventual)
4. Mark **trust boundaries** and where auth/z decisions are made

Produce a sequence diagram per journey (see [DIAGRAMS.md](DIAGRAMS.md) → Sequence).

### Step 5 — Identify Cross-Cutting Concerns

Address each explicitly:

| Concern | Questions to answer |
|---------|---------------------|
| **Observability** | How is each component traced, metered, and logged? |
| **Security** | Where is authn/z enforced? What is the secrets strategy? |
| **Resilience** | Retry, circuit-breaker, bulkhead placements |
| **Deployability** | How is each component built, tested, and promoted? |
| **Data ownership** | Who is the system of record for each entity? |
| **Versioning** | How are API and schema changes evolved without downtime? |

### Step 6 — Validate

Run the [QUALITY-CHECKLIST.md](QUALITY-CHECKLIST.md) against the design.
Every failing item must be resolved or accepted as a known risk with a mitigation plan.

## Output Format

Deliver architecture documentation in this order:

```markdown
## Architecture: <System Name>

### Context
One paragraph: what problem this system solves and for whom.

### Goals & Non-Goals
- Goals: ...
- Non-Goals: ...

### Non-Functional Requirements
| Attribute | Target |
|-----------|--------|
| Availability | 99.9% |
| p99 read latency | < 100 ms |
| ...

### Architecture Diagram
[Mermaid block — see DIAGRAMS.md]

### Components
For each component:
- **Name**: one-line purpose
- **Responsibilities**: bullet list
- **Interface**: key APIs / events / messages
- **Data owned**: entities this component is the system of record for
- **Dependencies**: upstream components/services

### Data Flow: <Key Journey>
[Mermaid sequence diagram]

### Cross-Cutting Concerns
[Section per concern from Step 5]

### Rejected Alternatives
| Option | Why Rejected |
|--------|-------------|

### Open Questions
Numbered list of unresolved issues with owner and due date.

### Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
```

## Common Mistakes to Avoid

- **Designing before constraining**: always capture NFRs first; they drive architecture more than functional requirements
- **Missing failure modes**: every async boundary needs an answer for "what happens when the downstream is down?"
- **God services**: if a component touches more than 3 unrelated domains, split it
- **Implicit data ownership**: every entity must have exactly one system of record
- **Synchronous chains > 3 hops deep**: indicates tight coupling; consider events or aggregation
- **No observability plan**: a system you cannot observe is a system you cannot operate
