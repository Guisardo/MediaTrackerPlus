# OWASP Top 10 (2021) — Architecture Review Checklist

For each category, evaluate the design against the questions listed. Mark each as:
- ✅ **Addressed** — explicit control exists and is documented
- ⚠️ **Partial** — some controls exist but gaps remain
- ❌ **Missing** — no control identified; must be remediated
- N/A — category does not apply to this system

---

## A01 — Broken Access Control

The #1 risk. Most common cause of breaches in web applications.

**Architecture questions**:
- [ ] Is authorisation enforced at the service/domain layer, not only at the routing layer?
- [ ] Is the default access posture "deny" (allowlist) rather than "allow" (denylist)?
- [ ] Can a user access another user's resources by changing an ID in a URL or request body (IDOR)?
- [ ] Are admin-only routes protected by a role check, not just a different URL prefix?
- [ ] Is directory listing disabled on file-serving infrastructure?
- [ ] Are CORS policies restrictive (not `*` for authenticated APIs)?
- [ ] Are JWT/session tokens validated for ownership on every access?

**Common failures**: IDOR on numeric IDs, missing ownership check when user is "just guessing" IDs, admin endpoints discoverable via path enumeration.

---

## A02 — Cryptographic Failures (formerly Sensitive Data Exposure)

**Architecture questions**:
- [ ] Is all sensitive data identified (PII, credentials, health data, financial data)?
- [ ] Is sensitive data encrypted at rest (field-level or full-disk)?
- [ ] Is TLS 1.2+ enforced on all connections (including internal service-to-service)?
- [ ] Are weak/deprecated algorithms absent (MD5, SHA-1 for integrity, RC4, DES, 3DES)?
- [ ] Are passwords hashed with a modern adaptive hash function (bcrypt cost ≥ 12, Argon2, scrypt)?
- [ ] Are encryption keys stored separately from the data they protect?
- [ ] Is sensitive data excluded from logs, URLs, and error responses?
- [ ] Is data minimisation applied (collect and retain only what is necessary)?

---

## A03 — Injection

SQL injection, NoSQL injection, OS command injection, LDAP injection, template injection.

**Architecture questions**:
- [ ] Is all database access via parameterised queries or a safe ORM (never string concatenation)?
- [ ] Is user input validated and sanitised at all trust boundaries?
- [ ] Is user-supplied data ever passed to `eval()`, `exec()`, `shell_exec()`, or similar?
- [ ] Are template engines used that auto-escape output by default?
- [ ] Is XML input processed through a parser configured to disable external entity (XXE) resolution?
- [ ] Are file paths constructed from user input? If so, are they canonicalised and validated?

---

## A04 — Insecure Design

Design-level flaws that cannot be patched in the code — only redesigned.

**Architecture questions**:
- [ ] Has threat modelling been performed (STRIDE or equivalent)?
- [ ] Are security requirements defined and traceable to implementation?
- [ ] Are rate limits applied to all user-facing operations (not just login)?
- [ ] Are resource consumption limits enforced (max file size, max items per request, query complexity)?
- [ ] Is business logic protected against abuse (e.g., can a user submit 1000 reviews per second)?
- [ ] Are "forgot password" and "magic link" flows resistant to account enumeration?
- [ ] Is multi-tenancy isolation enforced at the data layer (not just filtered queries)?

---

## A05 — Security Misconfiguration

Default settings, open cloud storage, unnecessary features enabled, verbose errors.

**Architecture questions**:
- [ ] Are default credentials changed on all infrastructure (databases, admin consoles)?
- [ ] Are development/debug features disabled in production (debug mode, stack traces, admin UIs)?
- [ ] Is the principle of least privilege applied to all cloud IAM roles?
- [ ] Are S3 buckets (or equivalent) private by default with explicit public grants only where needed?
- [ ] Are security HTTP headers set (HSTS, CSP, X-Frame-Options, X-Content-Type-Options)?
- [ ] Are error responses sanitised in production (no stack traces, no internal paths)?
- [ ] Is the dependency tree regularly scanned for misconfigurations (e.g., open npm packages)?

---

## A06 — Vulnerable and Outdated Components

**Architecture questions**:
- [ ] Is a dependency scanner (Dependabot, Snyk, OWASP Dependency-Check) integrated into CI?
- [ ] Are high/critical CVEs in direct dependencies resolved within a defined SLA (e.g., 7 days for critical)?
- [ ] Are transitive dependencies monitored (not just direct dependencies)?
- [ ] Are unused dependencies removed from the package manifest?
- [ ] Is the container base image updated regularly and scanned?
- [ ] Is the runtime (Node.js, Python, JVM) on a supported version with active security patches?

---

## A07 — Identification and Authentication Failures

**Architecture questions**:
- [ ] Is MFA available for privileged accounts (admin, API key management)?
- [ ] Are passwords validated against known-breached lists (HaveIBeenPwned API, local list)?
- [ ] Is credential stuffing mitigated by rate limiting + progressive delay (not just CAPTCHA)?
- [ ] Are session IDs regenerated after privilege escalation (login, role change)?
- [ ] Are sessions invalidated on logout (server-side, not just client-side cookie deletion)?
- [ ] Are "remember me" tokens stored as hashed values in the database?
- [ ] Is the password reset flow single-use and time-limited (< 15 minutes)?

---

## A08 — Software and Data Integrity Failures

**Architecture questions**:
- [ ] Are CI/CD pipeline configurations protected from unauthorised modification?
- [ ] Are dependency lockfiles (package-lock.json, Pipfile.lock) committed and enforced?
- [ ] Are package integrity checks in place (npm audit signatures, hash verification)?
- [ ] Is the build pipeline protected against supply chain attacks (pinned actions, signed commits)?
- [ ] Are deserialised objects from untrusted sources validated before use?
- [ ] Are auto-update mechanisms for plugins/extensions disabled or signed?

---

## A09 — Security Logging and Monitoring Failures

**Architecture questions**:
- [ ] Are all authentication events logged (success, failure, MFA bypass attempts)?
- [ ] Are all authorisation failures (403s) logged with the attempted resource and actor?
- [ ] Are all high-value transactions logged (payments, data exports, admin actions)?
- [ ] Are logs tamper-evident and stored separately from the application (not on the same host)?
- [ ] Are alerts configured for threshold anomalies (e.g., > 100 failed logins in 1 minute)?
- [ ] Is the log format structured (JSON) and enriched with correlation IDs?
- [ ] Are logs monitored by a SIEM or equivalent with defined response procedures?

---

## A10 — Server-Side Request Forgery (SSRF)

**Architecture questions**:
- [ ] Does the application make HTTP requests to URLs provided by users or derived from user input?
- [ ] If yes, is the target URL validated against an allowlist of approved domains?
- [ ] Are private IP ranges (10.x, 172.16.x, 192.168.x, 169.254.x, localhost) blocked?
- [ ] Is the DNS resolution result validated (not just the input URL) to prevent DNS rebinding?
- [ ] Is the application deployed in a network segment that limits egress to known external hosts?
- [ ] Are cloud metadata endpoints (169.254.169.254) unreachable from the application?

---

## OWASP Coverage Summary Table

```markdown
| # | Category | Status | Notes |
|---|---------|--------|-------|
| A01 | Broken Access Control | | |
| A02 | Cryptographic Failures | | |
| A03 | Injection | | |
| A04 | Insecure Design | | |
| A05 | Security Misconfiguration | | |
| A06 | Vulnerable and Outdated Components | | |
| A07 | Identification and Authentication Failures | | |
| A08 | Software and Data Integrity Failures | | |
| A09 | Security Logging and Monitoring Failures | | |
| A10 | Server-Side Request Forgery | | |
```
