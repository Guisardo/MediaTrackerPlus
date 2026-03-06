# Technical Debt Scoring Model

A lightweight, repeatable scoring model for prioritising technical debt items.

---

## Priority Score Formula

```
Priority Score = (Impact × Frequency) / Effort
```

Score each axis 1–5:

| Axis | 1 | 3 | 5 |
|------|---|---|---|
| **Impact** | Cosmetic / style issue | Slows development or causes occasional bugs | Causes production incidents, security risk, or blocks new features |
| **Frequency** | Rarely encountered (< once/month) | Encountered weekly by some team members | Encountered daily, affects every developer or every deployment |
| **Effort** | Weeks of risky refactoring | A few days with moderate risk | Hours of isolated, low-risk changes |

**Priority Score ranges**:
- **≥ 10**: Immediate — address in the current sprint or dedicate a spike
- **5–9**: High — include in the next 1–2 sprint planning cycles
- **2–4**: Medium — add to the backlog; address in a dedicated cleanup sprint
- **< 2**: Low — log and defer; revisit quarterly

---

## Debt Item Template

```markdown
| # | Module / File | Category | Description | Impact | Frequency | Effort | Score |
|---|--------------|----------|-------------|--------|-----------|--------|-------|
| D1 | src/services/metadata.ts | Architectural | Business logic mixed into the HTTP adapter; cannot unit-test without hitting the network | 4 | 4 | 3 | 5.3 |
| D2 | src/db/queries.ts | Performance | N+1 query pattern on media-items list fetch | 5 | 5 | 2 | 12.5 |
| D3 | package.json | Dependency | `passport` is 3 major versions behind; CVE-2023-xxxx open | 5 | 3 | 2 | 7.5 |
```

---

## Impact × Category Risk Matrix

Some categories carry inherent risk floors that override the formula:

| Category | Minimum Impact Score | Reason |
|----------|---------------------|--------|
| Security | 4 | Any known vulnerability is high impact by default |
| Dependency (CVE) | 5 | Exploitable CVEs are always critical |
| Data loss risk | 5 | Correctness bugs affecting stored data |
| Architectural | 3 | Structural debt compounds; low-scoring items still warrant tracking |
| Code Quality | 1 | Style debt rarely justifies immediate action |

---

## Debt Density Score (Module Level)

For each module or service, calculate a **Debt Density Score**:

```
Debt Density = Total Priority Score of all items in module / Approximate LOC × 1000
```

Modules with high Debt Density are candidates for a focused refactoring sprint, even if individual items score medium.

| Density | Interpretation |
|---------|---------------|
| > 50 | Critical — module is a liability |
| 20–50 | High — plan a dedicated refactor |
| 5–20 | Moderate — include in ongoing cleanup |
| < 5 | Healthy |

---

## Effort Estimation Guidelines

| Effort Score | Characteristics |
|-------------|----------------|
| **5 (Low)** | Isolated change in 1–3 files, no API or schema changes, existing tests cover the area, reversible in < 1 hour |
| **4** | 3–5 files, minor interface change, tests need updating, reversible in < 1 day |
| **3 (Medium)** | 5–15 files, schema migration or API change, new tests required, rollback plan needed |
| **2** | Cross-cutting change, multiple services, requires feature flag or strangler, staging validation needed |
| **1 (High)** | Major architecture change, weeks of work, risk of regression, requires dedicated team |

---

## Compound Debt Detection

Flag items as **Compound Debt** when two or more debt items affect the same component.
Compound debt is more dangerous than the sum of its parts because:
- Fixes interfere with each other
- The component is high-churn and therefore high-risk
- Cognitive load is highest for the module team members use most

When compound debt is detected:
1. Group all items into a single **Theme**
2. Elevate the Priority Score of the theme to the max of any constituent item + 2
3. Plan the theme as a single focused effort, not piecemeal fixes
