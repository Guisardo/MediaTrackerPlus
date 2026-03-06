# Architecture Quality Checklist

Run this checklist against any proposed design before sign-off. Each section maps to a quality attribute. A "No" answer must be resolved or documented as an accepted risk with a mitigation plan.

---

## 1. Correctness

- [ ] All functional requirements are addressed by at least one component
- [ ] All data flows are traceable end-to-end for every key user journey
- [ ] No component has undefined behaviour under documented load scenarios
- [ ] Every entity has exactly one system of record

---

## 2. Security

- [ ] Every trust boundary is identified and has an explicit authentication/authorisation check
- [ ] Sensitive data (PII, credentials, keys) is identified and protected at rest and in transit
- [ ] The principle of least privilege is applied to all service accounts and IAM roles
- [ ] There are no direct database connections from internet-facing components
- [ ] API endpoints are protected by rate limiting
- [ ] Secrets are not stored in code, config files, or environment variables in plaintext

---

## 3. Reliability & Resilience

- [ ] Single points of failure are identified; each has a mitigation (redundancy, circuit breaker, fallback)
- [ ] Every async call has a defined retry strategy and dead-letter queue
- [ ] The system degrades gracefully when a non-critical dependency is unavailable
- [ ] Data durability requirements are met (backup strategy, point-in-time recovery)
- [ ] Availability target (e.g., 99.9%) is achievable given the current topology

---

## 4. Scalability & Performance

- [ ] The expected peak load is documented and the design has been reasoned against it
- [ ] Components that will be bottlenecks under load have been identified and addressed
- [ ] Database query patterns (N+1, missing indexes) have been reviewed for critical paths
- [ ] Stateful components (sessions, uploads) do not prevent horizontal scaling of stateless components
- [ ] Caching strategy is defined for high-read, low-mutation data

---

## 5. Observability

- [ ] Every service emits structured logs with a correlation/trace ID propagated across calls
- [ ] Key business metrics are instrumented (not just infrastructure metrics)
- [ ] Health-check and readiness endpoints are defined for every deployable component
- [ ] Alerting thresholds are defined for SLO-breaching conditions
- [ ] Distributed tracing is planned (e.g., OpenTelemetry) for async flows

---

## 6. Maintainability & Evolvability

- [ ] Bounded contexts are clearly defined; no component crosses more than one context's boundary
- [ ] Internal implementation details are not exposed across component interfaces
- [ ] Database schemas are owned by a single service; no shared databases across services
- [ ] External dependencies are abstracted behind interfaces (no vendor lock-in at the domain layer)
- [ ] Breaking API changes have a versioning strategy

---

## 7. Testability

- [ ] The core domain can be unit-tested without starting infrastructure (database, queues, HTTP)
- [ ] Integration tests can be run against a local or containerised environment
- [ ] Contract tests are planned for any async or inter-service communication

---

## 8. Deployability

- [ ] Each deployable unit can be built, tested, and deployed independently
- [ ] Database migrations can be applied without downtime (backward-compatible schema changes)
- [ ] A rollback strategy is defined for every component
- [ ] The deployment pipeline is documented (CI/CD stages, environment promotion)

---

## 9. Cost

- [ ] Resource sizing is proportional to expected load; no significant over-provisioning
- [ ] Data transfer costs across regions/services have been considered
- [ ] Retention and storage costs for logs, metrics, and data are budgeted

---

## 10. Documentation

- [ ] An Architecture Decision Record (ADR) exists for every significant technology or pattern choice
- [ ] The system context diagram is up to date
- [ ] Runbooks exist for critical operational procedures (deployment, rollback, incident response)
- [ ] Open questions are listed with owners and target resolution dates

---

## Sign-Off Summary

| Quality Attribute | Pass | Issues | Accepted Risks |
|-------------------|------|--------|---------------|
| Correctness | | | |
| Security | | | |
| Reliability | | | |
| Scalability | | | |
| Observability | | | |
| Maintainability | | | |
| Testability | | | |
| Deployability | | | |
| Cost | | | |
| Documentation | | | |

**Overall verdict**: APPROVED / CONDITIONAL (list items) / BLOCKED (list blockers)
