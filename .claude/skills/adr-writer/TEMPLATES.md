# ADR Templates

Two templates are provided: MADR (Markdown Architectural Decision Records) for most cases, and Y-Statements for quick one-liners when a full ADR is overkill.

---

## Template 1 — MADR (Recommended)

Markdown Architectural Decision Records (MADR) — [madr.adr.github.io](https://madr.adr.github.io)

```markdown
# <number>. <title>

Date: YYYY-MM-DD
Status: Proposed | Accepted | Rejected | Deprecated | Superseded by [ADR-NNNN](NNNN-slug.md)
Deciders: <list of people who made or approved the decision>
Consulted: <list of people consulted for input>
Informed: <list of people to be notified of the outcome>

---

## Context and Problem Statement

<!-- Describe the context and problem. What forces are at play?
     What decision is required? Be specific enough that someone unfamiliar
     with the project could understand the situation. -->

## Decision Drivers

<!-- List the most important factors driving this decision.
     These become the criteria for evaluating options. -->

* Driver 1 — e.g., "Must support 10k concurrent users"
* Driver 2 — e.g., "Team has no prior experience with Kafka"
* Driver 3 — e.g., "Must deploy within the existing AWS account"

## Considered Options

* Option A — <short title>
* Option B — <short title>
* Option C — <short title>

## Decision Outcome

Chosen option: **Option X**, because <one-sentence rationale referencing the drivers>.

### Positive Consequences

* <!-- Benefit 1 -->
* <!-- Benefit 2 -->

### Negative Consequences

<!-- Be honest. A good ADR acknowledges trade-offs. -->

* <!-- Trade-off or cost accepted -->
* <!-- What we lose or what gets harder -->

### Re-evaluation Trigger

<!-- When should this decision be revisited?
     e.g., "Revisit if message throughput exceeds 100k/s"
     or "Revisit after the v2.0 release when usage patterns are clearer" -->

---

## Pros and Cons of the Options

### Option A — <title>

<Short description of the option>

* Good, because <argument>
* Good, because <argument>
* Bad, because <argument>
* Neutral, because <argument>

### Option B — <title>

<Short description>

* Good, because <argument>
* Bad, because <argument>
* Bad, because <argument>

### Option C — <title>

<Short description>

* Good, because <argument>
* Bad, because <argument>

---

## Links

<!-- Optional: links to related ADRs, tickets, RFCs, or documentation -->

* Relates to [ADR-NNNN](NNNN-slug.md)
* Supersedes [ADR-NNNN](NNNN-slug.md)
* [Relevant RFC or design doc](URL)
```

---

## Template 2 — Y-Statement (Quick Record)

For low-stakes or obvious decisions that still warrant a record. Produces a single-sentence decision capture.

```markdown
# <number>. <title>

Date: YYYY-MM-DD
Status: Accepted
Deciders: <names>

---

## Decision

In the context of **<situation>**,
facing **<concern>**,
we decided **<option>**,
to achieve **<quality/benefit>**,
accepting **<downside>**.

## Notes

<!-- Any additional context, links, or constraints worth preserving. -->
```

**Example**:

> In the context of **choosing a date library for the frontend**,
> facing **date-fns vs dayjs vs native Intl API**,
> we decided **to use date-fns**,
> to achieve **tree-shakeable builds and TypeScript-first API without a global locale mutation problem**,
> accepting **slightly larger bundle than dayjs for projects that use many functions**.

---

## Template 3 — Lightweight Spike Record

For technical spikes (time-boxed research) where the outcome informs a subsequent ADR.

```markdown
# Spike: <topic>

Date: YYYY-MM-DD
Conducted by: <names>
Time-box: <X days>

---

## Question

<!-- What specific question were we trying to answer? -->

## Approach

<!-- How did we investigate? What did we build, read, or benchmark? -->

## Findings

<!-- What did we learn? Include benchmarks, PoC results, or key references. -->

## Recommendation

<!-- What does this spike suggest we should do? This may feed directly into an ADR. -->

## Follow-up ADR

<!-- Link to the ADR this spike informs, once written. -->
```
