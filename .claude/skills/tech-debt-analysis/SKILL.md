---
name: tech-debt-analysis
description: Identify, score, prioritize, and create a remediation roadmap for technical debt. Use when the user asks to audit code quality, find areas of technical debt, assess maintainability, prioritize refactoring work, or plan a clean-up sprint. Triggers: find tech debt, code quality audit, refactoring plan, what should we clean up, maintainability review.
context: fork
agent: software-architect
---

# Tech Debt Analysis — Audit, Score & Remediation Roadmap

This skill provides a systematic process for surfacing, scoring, and prioritizing technical debt so teams can make informed decisions about when and how to address it.

## Quick Reference

| Goal | Reference |
|------|-----------|
| Score and classify debt items | [SCORING.md](SCORING.md) |
| Format a remediation roadmap | [ROADMAP-TEMPLATE.md](ROADMAP-TEMPLATE.md) |

## Debt Taxonomy

Classify every debt item before scoring it:

| Category | Examples |
|----------|---------|
| **Architectural** | Wrong pattern for the problem, tight coupling, missing abstraction layers |
| **Code Quality** | God classes, deep nesting, magic numbers, duplicated logic |
| **Test Coverage** | Missing unit/integration tests, brittle tests, no contract tests |
| **Documentation** | Missing ADRs, outdated READMEs, undocumented APIs |
| **Dependency** | Outdated / unmaintained packages, security-vulnerable dependencies |
| **Operational** | Missing observability, no alerting, manual deployment steps |
| **Security** | Hardcoded secrets, missing input validation, outdated auth patterns |
| **Performance** | N+1 queries, missing indexes, synchronous operations that could be async |

## Analysis Workflow

### Step 1 — Discovery

For a codebase analysis, examine:

1. **File-level signals**: files > 500 lines, cyclomatic complexity hotspots, files changed in > 50% of recent commits
2. **Dependency graph**: circular dependencies, components that fan out to > 5 others
3. **Test coverage gaps**: modules with < 60% coverage or no tests at all
4. **Dependency age**: packages with major versions behind or no updates in > 2 years
5. **Open issues/TODOs**: grep for `TODO`, `FIXME`, `HACK`, `XXX` in source code
6. **Deployment pain**: manual steps, flaky tests, long CI times

Produce an inventory list: `[file or module, debt category, one-line description]`

### Step 2 — Score Each Item

Apply the scoring model from [SCORING.md](SCORING.md).
Each debt item gets a **Priority Score = Impact × Frequency / Effort**.

### Step 3 — Group into Themes

Cluster related items into 3-7 coherent **debt themes**:
- Themes make it easier to plan focused sprints
- A theme should have a clear "definition of done"
- Example themes: "Eliminate database layer coupling", "Achieve 80% test coverage on payment flows", "Migrate off deprecated auth library"

### Step 4 — Build the Roadmap

Use [ROADMAP-TEMPLATE.md](ROADMAP-TEMPLATE.md) to structure the output.
Sequence themes by: (1) blocking risk, (2) priority score, (3) team capacity fit.

### Step 5 — Present Findings

Structure the output as:

```markdown
## Technical Debt Report: <Project / Module>

### Executive Summary
3-5 sentences: overall health, biggest risks, recommended immediate actions.

### Debt Inventory
[Full scored list from Step 2]

### Priority Matrix
[2x2: Impact vs. Effort quadrant placement]

### Themes
[Grouped clusters from Step 3]

### Remediation Roadmap
[See ROADMAP-TEMPLATE.md]

### Metrics to Track
How will we know we're making progress?
- Test coverage %
- Mean time to deploy
- Number of P0 incidents caused by known debt
- Dependency vulnerability count
```

## Anti-Patterns to Surface

Actively look for these high-value debt patterns:

| Anti-Pattern | Detection Signal |
|-------------|-----------------|
| **Strangler monolith** | Large service with mixed domains, no clear module boundaries |
| **Distributed monolith** | Microservices that all deploy together or have shared databases |
| **Anemic domain model** | Business logic in controllers/services, not domain objects |
| **Leaky abstractions** | Implementation details escaping across layer boundaries |
| **Test ice-cream cone** | More E2E tests than unit tests; slow, brittle test suite |
| **Config in code** | Environment-specific values hardcoded rather than injected |
| **Phantom services** | Services that exist but are only called from one place — should be a library |
| **Chatty interfaces** | APIs that require 5+ calls to complete one user action |

## When NOT to Pay Down Debt

Not all debt should be addressed. Document a rationale for deferring when:
- The component is **planned for replacement** in the next 2 quarters
- The debt is in **dead code paths** with no active users
- The **effort exceeds the benefit** by > 3x and there are no reliability risks
- The team has **insufficient context** to refactor safely without a dedicated spike
