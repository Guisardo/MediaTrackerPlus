# Architectural Patterns Catalogue

A reference of commonly used architectural patterns, their trade-offs, and the signals that indicate when to apply each one.

---

## 1. Layered (N-Tier) Architecture

**Structure**: Presentation → Application/API → Domain → Infrastructure

**Apply when**:
- CRUD-heavy application with low business logic complexity
- Small team; simplicity is more important than scalability
- Well-understood domain unlikely to change significantly

**Strengths**: Simple mental model, easy onboarding, well-supported by frameworks

**Weaknesses**: Coupling between layers tends to grow; anemic domain model risk; doesn't scale well when business logic becomes complex

**Key constraints**: Dependencies only flow **downward**. Infrastructure must never be referenced from the Domain layer.

---

## 2. Hexagonal Architecture (Ports & Adapters)

**Structure**: Core Domain ← Ports (interfaces) ← Adapters (implementations for HTTP, DB, queues, etc.)

**Apply when**:
- Business logic is complex and must be testable in isolation
- Multiple delivery mechanisms (REST API, CLI, workers) share the same domain
- Likely to swap out infrastructure (e.g., change databases)

**Strengths**: Domain is infrastructure-agnostic; excellent testability; explicit dependency inversion

**Weaknesses**: More boilerplate; higher initial complexity; over-engineering risk for simple CRUD apps

**Key constraints**: The domain core has **zero knowledge** of any framework, ORM, or external service. All communication goes through ports.

---

## 3. Event-Driven Architecture (EDA)

**Structure**: Services communicate via events (published to a broker) rather than direct calls.

**Apply when**:
- Loose coupling between services is required
- Workflows span multiple bounded contexts
- Event sourcing or audit log is a requirement
- High throughput, write-heavy workloads

**Strengths**: Temporal decoupling, independent scaling, natural audit trail, extensibility (add consumers without changing producers)

**Weaknesses**: Harder to reason about flows, eventual consistency, debugging complexity, message ordering challenges

**Key constraints**: Events are **facts** (past tense, immutable). Commands are requests and may be refused. Never put business logic inside a broker.

---

## 4. CQRS (Command Query Responsibility Segregation)

**Structure**: Write path (Commands → Write Model → Event Store or DB) is separate from Read path (Read Model → Denormalised query DB or cache).

**Apply when**:
- Read and write workloads have very different shapes or scaling needs
- Complex domain with many query projections needed
- Pairing with Event Sourcing

**Strengths**: Optimised read and write models independently, natural audit trail with ES, scalable reads

**Weaknesses**: Significant added complexity; eventual consistency on read side; overkill for most CRUD applications

**Key rule**: Do not apply CQRS unless you have a concrete requirement for it. The complexity cost is high.

---

## 5. Microservices

**Structure**: System decomposed into independently deployable services, each owning its data.

**Apply when**:
- Multiple independent teams need to deploy without coordinating
- Services have significantly different scaling requirements
- Organisational size justifies the operational overhead (Conway's Law)

**Strengths**: Independent deployment, independent scaling, polyglot permitted, fault isolation

**Weaknesses**: Distributed systems complexity (network failures, eventual consistency, distributed tracing), high operational overhead, latency of inter-service calls

**Key rule**: Microservices are an organisational solution as much as a technical one. If you don't have Conway's Law problems, a modular monolith is almost always a better default.

---

## 6. Modular Monolith

**Structure**: Single deployable unit divided into strongly-bounded internal modules with enforced dependency rules.

**Apply when**:
- Small-to-medium team
- Domain boundaries aren't yet stable
- Starting a new product (avoid premature decomposition)
- Performance requires in-process communication

**Strengths**: Simple deployment, in-process calls (no network overhead), easy refactoring, low operational complexity

**Weaknesses**: Must enforce boundaries through code conventions; horizontal scaling requires replicating the whole process; team coordination required for deployments

**Key rule**: Default to modular monolith and migrate to microservices only when a specific boundary has independent scaling or team ownership needs.

---

## 7. Strangler Fig (Migration Pattern)

**Structure**: New functionality is built in the new system. Old requests are routed to the legacy system via a facade, gradually shifting more traffic to the new system until the legacy can be removed.

**Apply when**:
- Migrating a legacy system incrementally without a big-bang rewrite
- Risk of rewrite failure is high

**Strengths**: Incremental migration, always working system, rollback available at each step

**Weaknesses**: Temporary dual-system complexity, facade maintenance cost, risk of the facade becoming permanent

---

## 8. Saga Pattern (Distributed Transactions)

**Structure**: A sequence of local transactions coordinated via messages/events. Each step has a compensating transaction for rollback.

**Variants**: Choreography (services react to each other's events) vs. Orchestration (a central saga orchestrator drives the flow).

**Apply when**:
- Multi-step workflow spans multiple services with no shared database
- You need consistency guarantees across service boundaries without distributed transactions

**Strengths**: Works without 2PC, resilient to partial failures

**Weaknesses**: Complex compensating logic, eventual consistency, harder to debug

**Key rule**: Prefer orchestration for complex sagas (easier to reason about state). Prefer choreography for simple linear flows.

---

## Pattern Selection Matrix

| Situation | Recommended Pattern |
|-----------|-------------------|
| New product, small team | Modular Monolith |
| Multiple teams, stable domain boundaries | Microservices |
| Complex business logic, many projections | CQRS (possibly with ES) |
| Audit trail, temporal queries | Event Sourcing |
| High decoupling, notifications, integrations | Event-Driven Architecture |
| Legacy migration | Strangler Fig |
| Multi-service transactions | Saga |
| Most applications | Hexagonal Architecture (within any of the above) |
