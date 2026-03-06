# STRIDE Threat Modeling Guide

A structured approach to identifying and classifying threats using the STRIDE methodology.

---

## STRIDE Overview

STRIDE is a threat categorisation framework where each letter represents a class of threat:

| Threat | Property Violated | Example |
|--------|------------------|---------|
| **S**poofing | Authentication | Attacker uses a stolen session token to impersonate a legitimate user |
| **T**ampering | Integrity | Attacker modifies a JWT payload to change their role to `admin` |
| **R**epudiation | Non-repudiation | User denies submitting a review; no audit log to dispute the claim |
| **I**nformation Disclosure | Confidentiality | Error response includes a SQL query containing another user's data |
| **D**enial of Service | Availability | Attacker submits millions of search requests; database collapses |
| **E**levation of Privilege | Authorisation | Standard user accesses the admin endpoint by incrementing the user ID |

---

## Step-by-Step STRIDE Analysis

### Step 1 — Build the Data Flow Diagram

Draw a Level-1 DFD (see [SKILL.md](SKILL.md) Step 2). Every element in the DFD can be a target:

| DFD Element | Types of Threat |
|-------------|----------------|
| **External entity** (user, external service) | Spoofing, Repudiation |
| **Process** (service, function) | Spoofing, Tampering, Repudiation, Information Disclosure, DoS, EoP |
| **Data store** (database, cache, file system) | Tampering, Information Disclosure, DoS |
| **Data flow** (network call, message, event) | Tampering, Information Disclosure, DoS |

### Step 2 — Apply STRIDE per Element

For each process and trust boundary crossing, systematically ask all six STRIDE questions:

```
Component: API Server — /auth/login endpoint

S (Spoofing):
  - Can an attacker impersonate a legitimate user? → Credential stuffing, brute force login
  - Can an attacker spoof the source IP? → Not directly via API; rate limiting must not rely solely on IP

T (Tampering):
  - Can the request body be tampered with in transit? → HTTPS mitigates; check for MITM at client level
  - Can the JWT returned be forged? → Depends on algorithm; HS256 with a weak secret is vulnerable

R (Repudiation):
  - Can a user deny a login attempt? → Log all login attempts (success and failure) with timestamp and IP

I (Information Disclosure):
  - Does the error response reveal whether an email address is registered? → User enumeration risk
  - Does a failed login reveal timing information? → Constant-time comparison required for passwords

D (Denial of Service):
  - Can an attacker lock out accounts via repeated failures? → Account lockout / progressive delay needed
  - Can an attacker exhaust database connections via concurrent login requests? → Connection pool limits

E (Elevation of Privilege):
  - Can an unauthenticated user reach authenticated routes? → Middleware order matters; test explicitly
  - Can a standard user trigger admin-only operations? → Role check in business logic, not just routing
```

### Step 3 — Rate Each Threat

Use the DREAD or simplified severity model:

**Simplified Severity (recommended)**:

| Factor | 1 (Low) | 3 (Medium) | 5 (High) |
|--------|---------|-----------|---------|
| **Damage** | Cosmetic | Data loss for one user | Mass data breach or service outage |
| **Reproducibility** | Hard to replicate | Reproducible with effort | Trivially reproducible |
| **Exploitability** | Requires physical access or insider | Requires network access + tool | Requires only a browser |
| **Affected users** | Single user | Small subset | All users |
| **Discoverability** | Requires source code access | Requires active probing | Publicly documented |

```
Severity Score = (Damage + Reproducibility + Exploitability + Affected + Discoverability) / 5

≥ 4.0 → CRITICAL
3.0–3.9 → HIGH
2.0–2.9 → MEDIUM
< 2.0 → LOW
```

### Step 4 — Assign Mitigations

For each rated threat, identify the control from [CONTROLS.md](CONTROLS.md) that addresses it.

**Mitigation categories**:
- **Prevent**: Remove the condition that makes the attack possible (e.g., parameterised queries prevent SQL injection)
- **Detect**: Log the attack attempt and alert (e.g., log repeated 401s; alert on threshold)
- **Respond**: Define the incident response procedure if the threat is realised
- **Accept**: Document that the risk is known and the residual risk is acceptable

---

## STRIDE Threat Register Template

```markdown
| ID | Component | Threat Category | Description | Severity | Mitigation | Status |
|----|-----------|----------------|-------------|----------|------------|--------|
| T1 | Login endpoint | Spoofing | Credential stuffing via automated login attempts | HIGH | Rate limiting per IP + email; progressive delay; CAPTCHA on threshold | Open |
| T2 | JWT token | Tampering | Weak HS256 secret allows JWT forgery | CRITICAL | Use RS256 asymmetric signing; rotate keys | Open |
| T3 | User profile API | Information Disclosure | GET /users/{id} returns all users, not just own profile | HIGH | Enforce ownership check: user.id === token.sub | Open |
| T4 | Search endpoint | DoS | Unbounded search with complex regex can exhaust CPU | MEDIUM | Input length limit; query timeout at DB level | Open |
| T5 | Audit logs | Repudiation | No log of media entry modifications | MEDIUM | Append-only audit log for all write operations | Accepted |
```

---

## Common Threats for Web Applications

### Authentication Threats (Spoofing)
- Credential stuffing / brute force → rate limiting, lockout, MFA
- Session fixation → regenerate session ID on login
- JWT algorithm confusion (none/HS256 when RS256 expected) → validate `alg` header server-side
- Password reset link hijacking → short expiry, single-use tokens, bind to user agent

### Data Integrity Threats (Tampering)
- Parameter pollution → validate all input; whitelist allowed parameters
- Mass assignment → explicit field allowlists in request parsing
- CSRF → SameSite cookies + CSRF token for state-changing operations
- Insecure direct object reference (IDOR) → ownership check on every resource access

### Logging Threats (Repudiation)
- No audit trail for sensitive operations → append-only log of all writes
- Logs are mutable by the application → write logs to an append-only store or SIEM

### Data Exposure Threats (Information Disclosure)
- User enumeration via timing or error messages → constant-time comparison; generic error messages
- Verbose error responses → catch-all error handler that returns generic 500 in production
- Sensitive data in URLs (query params, path) → move to headers or request body
- Insecure storage (plaintext passwords, unencrypted PII) → bcrypt, field-level encryption

### Availability Threats (Denial of Service)
- Regex DoS (ReDoS) → avoid backtracking regexes; use safe-regex library
- GraphQL query bombs → depth/complexity limits
- Large file uploads → size limits, streaming validation
- Slow POST attacks → connection/read timeout at load balancer

### Privilege Threats (Elevation of Privilege)
- Broken access control (BAC) → deny by default; check at service layer
- JWT role tampering → sign the role claim; validate on every request
- Admin functionality exposed via predictable paths → no security by obscurity; enforce auth
