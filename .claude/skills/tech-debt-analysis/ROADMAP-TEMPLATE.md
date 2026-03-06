# Technical Debt Remediation Roadmap Template

Use this template to structure a remediation roadmap after completing the debt inventory and scoring.

---

## Roadmap Structure

```markdown
# Technical Debt Remediation Roadmap — <Project/Module>
Generated: YYYY-MM-DD
Scope: <What was audited>
Total debt items: N | Critical: X | High: Y | Medium: Z | Low: W

---

## Executive Summary

<3–5 sentences covering: overall health assessment, top 2–3 immediate risks,
recommended first action, and expected outcome after executing the roadmap.>

---

## Debt Themes

### Theme 1: <Name> (Priority: CRITICAL | HIGH | MEDIUM)

**Items included**: D2, D7, D12
**Total score**: 28.5
**Estimated effort**: 3–5 days

**Goal**: One sentence describing what "done" looks like.

**Why now**: Specific risk or cost of deferring.

**Tasks**:
- [ ] Task 1 — owner, estimated days
- [ ] Task 2 — owner, estimated days
- [ ] Task 3 — owner, estimated days

**Definition of Done**:
- [ ] Specific, measurable outcome (e.g., "All media-items list queries execute in < 50ms under load test")
- [ ] Tests added or updated
- [ ] No regression in existing test suite
- [ ] ADR written if architectural decision changed

**Success Metric**: How will we measure improvement?

---

### Theme 2: <Name>

[Repeat structure]

---

## Sequencing

| Wave | Theme | Rationale |
|------|-------|-----------|
| Wave 1 (Sprint N) | Theme 1: N+1 Query Fix | Blocking production SLO |
| Wave 1 (Sprint N) | Theme 3: CVE-2023-xxxx | Security — cannot wait |
| Wave 2 (Sprint N+1) | Theme 2: Auth Library Upgrade | Depends on Wave 1 session changes |
| Wave 3 (Sprint N+2) | Theme 4: Test Coverage | Safer to add tests after structural changes |
| Backlog | Theme 5–7 | Low priority; address in quarterly cleanup |

Rules for sequencing:
1. Items with security or data integrity risk go first, regardless of effort
2. Structural refactors precede test additions (tests written against old structure become noise)
3. Dependency upgrades that affect multiple themes are extracted to their own wave
4. Items that unblock other items (e.g., adding abstractions that enable further refactoring) go first

---

## Not Addressed (Deferred Items)

| Item | Reason for Deferral | Review Date |
|------|---------------------|-------------|
| D15: Legacy auth module | Planned for replacement in v2.0 | 2024-Q3 |
| D18: Unused feature flag service | Dead code; will be removed with the feature | 2024-Q2 |

---

## Progress Tracking Metrics

Track these metrics to demonstrate improvement over time:

| Metric | Baseline | Wave 1 Target | Final Target |
|--------|----------|--------------|-------------|
| Test coverage (critical paths) | 42% | 65% | 80% |
| p95 media-items list latency | 850ms | 200ms | 150ms |
| Open CVEs | 3 | 0 | 0 |
| Avg. build time | 8m 30s | 6m | 5m |
| Mean time to deploy | 45m | 20m | 15m |

---

## Review Cadence

- **Weekly**: Track completion of in-flight theme tasks in sprint review
- **Monthly**: Re-run debt density score on modified modules; adjust roadmap if new critical items surface
- **Quarterly**: Full audit pass; archive completed themes; re-score deferred items
```

---

## Tips for Roadmap Authors

**Batch, don't scatter**: Isolated debt fixes scattered across many sprints create more noise than value. Group related items into focused batches that a developer can complete in one mental context.

**Timebox spikes**: For debt items marked Effort=1 (high), run a time-boxed spike (1–2 days) before committing to a full estimate. Unknown unknowns are common in deep refactors.

**Don't hide the cost**: The roadmap should include honest estimates. Teams that hide the true cost of debt remediation to avoid pushback end up with surprise delays. Show the trade-off clearly.

**Link to incidents**: Where debt items correspond to past incidents, link the incident report. Nothing makes the business case for remediation faster than a concrete outage.

**Celebrate wins**: Each completed theme closes concrete risk. Make the metric improvement visible to the team and stakeholders.
