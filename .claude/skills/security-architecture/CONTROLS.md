# Security Controls Catalogue

A reference catalogue of security controls organised by threat category. When a threat is identified in a review, select the appropriate control from this catalogue and assign it to the finding.

---

## Authentication Controls

| Control ID | Control | Implementation Notes |
|------------|---------|---------------------|
| AUTH-01 | Password hashing with bcrypt | Cost factor ≥ 12 in production. Use bcrypt, not MD5/SHA1/SHA256 |
| AUTH-02 | JWT signing with RS256 | Asymmetric signing prevents forgery if signing key is stolen from a single service |
| AUTH-03 | JWT short expiry (access token) | 15 minutes for access tokens; rotate refresh tokens on each use |
| AUTH-04 | Refresh token rotation | Invalidate old refresh token when issuing a new one; detect reuse (stolen token signal) |
| AUTH-05 | Rate limiting on login | Max 5 attempts per email per 15 minutes; progressive delay (1s, 2s, 4s, ...) |
| AUTH-06 | Account lockout | Soft lock after 10 failures; unlock via email; notify user of lock |
| AUTH-07 | MFA (TOTP) | Require for admin accounts; recommend for all users |
| AUTH-08 | Session ID regeneration | Generate new session ID on login, privilege change, and logout |
| AUTH-09 | Secure cookie attributes | `HttpOnly; Secure; SameSite=Strict` for session cookies |
| AUTH-10 | Password reset — single-use token | Cryptographically random, 15-minute expiry, hashed in DB, invalidate on use |
| AUTH-11 | Breached password check | Validate against HaveIBeenPwned k-anonymity API on registration and password change |
| AUTH-12 | Constant-time comparison | Use `crypto.timingSafeEqual()` for password/token comparisons to prevent timing attacks |

---

## Authorisation Controls

| Control ID | Control | Implementation Notes |
|------------|---------|---------------------|
| AUTHZ-01 | Deny by default | All routes require authentication unless explicitly marked public |
| AUTHZ-02 | Ownership check | Every resource access verifies `resource.userId === token.sub` |
| AUTHZ-03 | RBAC at service layer | Role checks applied in business logic, not only routing/middleware |
| AUTHZ-04 | UUID resource IDs | Use UUIDs (not sequential integers) for all externally-referenced IDs |
| AUTHZ-05 | Indirect reference map | Where sequential IDs are needed internally, never expose them in APIs |
| AUTHZ-06 | Admin endpoint segregation | Admin APIs on a separate port, network, or with separate auth token scope |
| AUTHZ-07 | Scope-limited API tokens | Third-party API keys scoped to minimum required permissions |

---

## Input Validation Controls

| Control ID | Control | Implementation Notes |
|------------|---------|---------------------|
| INPUT-01 | Parameterised queries | Use ORM query builders or prepared statements; never string concatenation |
| INPUT-02 | Schema validation on entry | Validate all request bodies at API boundary (Zod, Joi, express-validator) |
| INPUT-03 | Output encoding | HTML-encode user content rendered in HTML; use a template engine with auto-escaping |
| INPUT-04 | Content-Type validation | Reject requests with unexpected Content-Type; validate file magic bytes on upload |
| INPUT-05 | File upload restrictions | Validate MIME type by content (not extension); enforce max file size; sanitise filename |
| INPUT-06 | URL allowlist (SSRF) | Validate URLs against allowlist of approved hostnames; block private IP ranges |
| INPUT-07 | XML external entity prevention | Disable DTD processing and external entity resolution in XML parsers |
| INPUT-08 | Safe regex | Avoid catastrophic backtracking; test regexes against ReDoS payloads |

---

## Data Protection Controls

| Control ID | Control | Implementation Notes |
|------------|---------|---------------------|
| DATA-01 | TLS 1.2+ on all connections | Enforce TLS for all internal and external communication; disable TLS 1.0/1.1 |
| DATA-02 | HSTS header | `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` |
| DATA-03 | Encryption at rest | AES-256 for database backups; encrypt sensitive fields (PII) at the application layer |
| DATA-04 | Secret management | Secrets in a secrets manager (AWS Secrets Manager, HashiCorp Vault); never in env vars or code |
| DATA-05 | Data minimisation | Collect only required data; delete when retention period expires |
| DATA-06 | PII redaction in logs | Strip or hash email, IP, and user identifiers in log output |
| DATA-07 | Secure deletion | Overwrite or cryptographically erase sensitive data on deletion |

---

## Security Headers

| Control ID | Header | Recommended Value |
|------------|--------|------------------|
| HDR-01 | `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| HDR-02 | `Content-Security-Policy` | `default-src 'self'; script-src 'self'; object-src 'none'` (adjust per app) |
| HDR-03 | `X-Content-Type-Options` | `nosniff` |
| HDR-04 | `X-Frame-Options` | `DENY` (or `SAMEORIGIN` if framing is needed) |
| HDR-05 | `Referrer-Policy` | `strict-origin-when-cross-origin` |
| HDR-06 | `Permissions-Policy` | Disable unused APIs: `camera=(), microphone=(), geolocation=()` |
| HDR-07 | Remove `X-Powered-By` | Do not expose server technology |

Use **Helmet.js** (Node.js) to apply all headers with secure defaults.

---

## Rate Limiting & Availability Controls

| Control ID | Control | Implementation Notes |
|------------|---------|---------------------|
| AVAIL-01 | Global rate limit | 1000 req/min per IP on all endpoints; return 429 with `Retry-After` |
| AVAIL-02 | Endpoint-specific limits | Login: 5/15min per email. Password reset: 3/hour. API key creation: 10/day |
| AVAIL-03 | Query timeout | Set DB query timeout at driver level (e.g., 5s); prevents slow query DoS |
| AVAIL-04 | Connection pool limits | Cap DB and Redis connection pools; prevents connection exhaustion |
| AVAIL-05 | GraphQL complexity limit | Max depth 10; max complexity 1000; reject over-limit queries with 400 |
| AVAIL-06 | Request size limit | Max body size 1MB for JSON; max file upload size explicitly defined per endpoint |
| AVAIL-07 | Circuit breaker | Apply to all external service calls; open circuit after 5 consecutive failures |

---

## Logging & Monitoring Controls

| Control ID | Control | Implementation Notes |
|------------|---------|---------------------|
| LOG-01 | Authentication event logging | Log login success, failure, MFA bypass attempt, password reset request |
| LOG-02 | Authorisation failure logging | Log all 403 responses with user ID, resource, and attempted action |
| LOG-03 | Admin action audit log | Log all admin operations: user management, config changes, data exports |
| LOG-04 | Structured logging | JSON format with: timestamp, level, correlation_id, user_id (hashed), action, result |
| LOG-05 | Correlation ID propagation | Generate a unique request ID at the edge; propagate through all service calls |
| LOG-06 | Anomaly alerting | Alert on: > 100 failed logins/min per IP, > 10 403s/min for one user, repeated 500s |
| LOG-07 | Log tamper protection | Write logs to an append-only destination (CloudWatch Logs, Splunk, Loki with immutability) |

---

## Supply Chain Controls

| Control ID | Control | Implementation Notes |
|------------|---------|---------------------|
| SUPPLY-01 | Dependency scanning in CI | Run `npm audit`, Snyk, or OWASP Dependency-Check on every PR |
| SUPPLY-02 | Lockfile enforcement | Commit and enforce `package-lock.json`; reject PRs that remove the lockfile |
| SUPPLY-03 | Pinned GitHub Actions | Pin all CI actions to a specific commit SHA, not a tag |
| SUPPLY-04 | Container image scanning | Scan base images for CVEs; rebuild images on base image updates |
| SUPPLY-05 | SBOM generation | Generate a Software Bill of Materials on each release |

---

## Control Selection Quick Reference

| Threat Category (STRIDE) | Primary Controls |
|--------------------------|-----------------|
| Spoofing | AUTH-01, AUTH-02, AUTH-05, AUTH-08 |
| Tampering | AUTH-02, INPUT-01, DATA-01, DATA-03 |
| Repudiation | LOG-01, LOG-02, LOG-03 |
| Information Disclosure | AUTHZ-02, DATA-01, DATA-06, HDR-02 |
| Denial of Service | AVAIL-01, AVAIL-02, AVAIL-03, AVAIL-06 |
| Elevation of Privilege | AUTHZ-01, AUTHZ-03, AUTH-07 |
