# Matrix Security Specification

**Patch:** PATCH-19 Enterprise Foundation  
**Scope:** Enterprise security controls for the Matrix platform  
**Status:** Specification — implementation in future patches

---

## Overview

Matrix handles customer data, fleet telemetry, service records, and financial information across multi-tenant organizations. Security is enforced at the API boundary, database row level, and operational layers. This document defines requirements for PATCH-19 and subsequent implementation.

**Principles:**

- **Defense in depth** — Multiple overlapping controls
- **Least privilege** — Role-based access with minimal default permissions
- **Tenant isolation** — No cross-organization data leakage
- **Auditability** — Immutable logs for sensitive actions
- **Privacy by design** — GDPR-ready data handling

---

## Role Based Access Control (RBAC)

### Model

- **Users** belong to one **Organization**
- **Roles** are organization-scoped named permission sets
- **Permissions** are atomic string keys (e.g. `workorders.write`)
- Users receive permissions via **UserRole** assignments; effective permissions are the union of all assigned roles
- **Super Admin** operates outside tenant scope for platform management only

### Enforcement layers

1. **API middleware** — Validates JWT, resolves `organizationId` and permission set
2. **Route guards** — Each endpoint declares required permission(s)
3. **Service layer** — Re-validates ownership before mutations
4. **Database** — All queries include `WHERE organizationId = :org AND deletedAt IS NULL`
5. **Object storage** — Signed URLs scoped to org prefix

### Permission evaluation

```
Request → Authenticate → Load user + roles → Union permissions
        → Check route permission → Execute with org filter → Audit log
```

### Deny by default

- Missing permission → `403 Forbidden`
- Resource in different org → `404 Not Found` (no information disclosure)
- Soft-deleted resources → `404` for non-admin roles

See permission matrix in `docs/blueprints/MATRIX_MASTER_BLUEPRINT.md`.

---

## Audit Logs

### Purpose

Compliance, accountability, incident investigation, and GDPR accountability (Article 5(2)).

### Requirements

- **Append-only** `AuditLog` table — no updates or deletes
- Log all authentication events: login success/failure, logout, password reset, invite accepted
- Log all mutations on: users, roles, customers, machines, work orders, inventory, orders, settings
- Log sensitive reads: bulk export, audit log access, PII download
- Each entry records: `actorId`, `organizationId`, `action`, `entityType`, `entityId`, `payload` (before/after JSON), `ipAddress`, `userAgent`, `createdAt`

### Retention

| Tier | Retention | Storage |
|------|-----------|---------|
| Security events | 7 years | Warm + cold archive |
| Operational mutations | 3 years | Database |
| Read/access logs | 1 year | Log aggregator |

### Access

- `audit.read` permission required
- Audit log queries themselves generate audit entries
- Export requires `audit.export` (org admin or auditor)

---

## Encryption

### Data in transit

- TLS 1.2+ required for all client and inter-service communication
- HSTS enabled on production domains
- Certificate management via platform provider (Railway, Cloudflare, etc.)

### Data at rest

- Database: provider-managed encryption (AES-256)
- Object storage (attachments, manuals, diagrams): server-side encryption
- Application secrets: environment variables / secret manager — never in source control
- Integration credentials in `Settings`: encrypted at application level before persistence (AES-256-GCM with per-org key derived from master secret)

### Password storage

- **Argon2id** (preferred) or **bcrypt** (cost factor ≥ 12)
- Unique salt per password
- Never log or return password hashes in API responses

### Field-level encryption (future)

- PII fields (SSN, payment tokens) encrypted with org-specific data keys
- Key rotation supported via envelope encryption

---

## Password Policies

### Complexity requirements

| Rule | Requirement |
|------|-------------|
| Minimum length | 12 characters |
| Complexity | At least 3 of: upper, lower, digit, special |
| Common passwords | Blocked against breached-password list (Have I Been Pwned API or local bloom filter) |
| Username similarity | Password must not contain email local-part |

### Lifecycle

| Policy | Setting |
|--------|---------|
| Password expiry | 90 days (configurable per org; 0 = no expiry) |
| History | Cannot reuse last 12 passwords |
| Lockout | 5 failed attempts → 15-minute lockout |
| Reset token | Single use, expires in 1 hour |
| Invite token | Expires in 7 days |

### Multi-factor authentication (future)

- TOTP and WebAuthn support for admin and technician roles
- Org-level MFA enforcement policy

---

## API Authentication

### Token model

- **Access token** — Short-lived JWT (15 minutes), contains `sub` (userId), `org` (organizationId), `permissions[]`, `iat`, `exp`
- **Refresh token** — Opaque token (7 days), stored hashed server-side, rotatable on use
- **API keys** (future) — Scoped service accounts for integrations; prefix `mtx_live_`, stored hashed

### JWT requirements

- Algorithm: RS256 or ES256 (asymmetric signing)
- Issuer and audience validation enforced
- No sensitive data in JWT payload
- Token revocation via refresh token blacklist and short access TTL

### Public endpoints

Only these accept unauthenticated requests:

- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/accept-invite`
- `POST /api/rra/webhook` (HMAC signature instead of JWT)

### Integration authentication

- RRA webhooks: HMAC-SHA256 signature in `X-Matrix-Signature` header
- Future SSO: SAML 2.0 / OIDC via dedicated `/api/auth/sso/*` routes

---

## Session Management

### Server-side sessions

- Refresh tokens stored in `Sessions` table (future) with: `userId`, `organizationId`, `tokenHash`, `userAgent`, `ipAddress`, `expiresAt`, `revokedAt`
- Logout revokes refresh token immediately
- "Logout all devices" revokes all user sessions

### Cookie policy (web clients)

| Attribute | Value |
|-----------|-------|
| `HttpOnly` | true |
| `Secure` | true (production) |
| `SameSite` | Strict or Lax |
| Path | `/api/auth` |

### Concurrent sessions

- Maximum 10 active sessions per user (configurable)
- Oldest session evicted on limit exceeded

### Idle timeout

- Web: 30 minutes idle → require re-auth
- Mobile: 7 days with refresh token rotation

---

## Rate Limiting

### Goals

Prevent brute force, credential stuffing, API abuse, and resource exhaustion.

### Limits (per IP + per user where authenticated)

| Endpoint class | Limit | Window |
|----------------|-------|--------|
| `POST /api/auth/login` | 10 requests | 15 min |
| `POST /api/auth/forgot-password` | 5 requests | 1 hour |
| General API (authenticated) | 1000 requests | 1 min |
| AI message endpoints | 30 requests | 1 min |
| Report export | 10 requests | 1 hour |
| RRA webhook | 500 requests | 1 min |

### Response

- `429 Too Many Requests` with `Retry-After` header
- Exponential backoff recommended for clients

### Implementation

- Redis or in-memory sliding window (single-node dev)
- Rate limit keys: `rl:ip:{ip}:{route}` and `rl:user:{userId}:{route}`

---

## Backups

### Database

| Environment | Frequency | Retention |
|-------------|-----------|-----------|
| Production | Continuous WAL + daily full | 30 daily, 12 monthly |
| Staging | Daily | 7 days |
| Development | Weekly (optional) | 2 weeks |

### Object storage

- Versioning enabled on attachment and manual buckets
- Cross-region replication for production (when available)

### Backup security

- Encrypted at rest
- Access restricted to break-glass admin role
- Backup restore tested quarterly

### Tenant export

- Org admin may request full data export (GDPR portability)
- Export delivered as encrypted archive; link expires in 72 hours

---

## Recovery

### Recovery objectives

| Metric | Target |
|--------|--------|
| RPO (Recovery Point Objective) | ≤ 1 hour |
| RTO (Recovery Time Objective) | ≤ 4 hours |

### Disaster recovery plan

1. Detect outage via health checks and alerting
2. Failover to standby database (PostgreSQL replica promotion)
3. Redeploy application from last known good container image
4. Verify integrity: migration version, org count spot check
5. Communicate status to customers via status page

### Incident classification

| Severity | Example | Response time |
|----------|---------|---------------|
| S1 | Data breach, full outage | 15 min |
| S2 | Partial outage, auth failure | 1 hour |
| S3 | Degraded performance | 4 hours |
| S4 | Minor bug, no data impact | Next business day |

### Runbooks (future)

- Database restore from backup
- Secret rotation after compromise
- Tenant data isolation verification

---

## Logging

### Application logs

- Structured JSON logs (timestamp, level, requestId, userId, organizationId, route, duration)
- **Never log:** passwords, tokens, full credit card numbers, unredacted PII
- PII in logs: mask email as `t***@example.com`

### Log levels

| Level | Usage |
|-------|-------|
| ERROR | Unhandled exceptions, failed auth spikes |
| WARN | Rate limit hits, deprecated API usage |
| INFO | Request completion, business events |
| DEBUG | Development only — disabled in production |

### Centralized aggregation

- Ship logs to centralized platform (e.g. Datadog, CloudWatch)
- Retention: 90 days hot, 1 year cold
- Correlation via `X-Request-Id` header propagated through services

### Security monitoring

- Alerts on: failed login spikes, permission denied bursts, unusual export volume, off-hours admin actions
- SIEM integration (future)

---

## GDPR Readiness

Matrix processes personal data for users, technicians, and customer contacts. Controls align with EU GDPR and serve as baseline for other privacy regimes.

### Lawful basis

| Data category | Basis |
|---------------|-------|
| User accounts | Contract / legitimate interest |
| Customer contacts | Contract with customer org |
| Audit logs | Legal obligation / legitimate interest |
| Marketing (future) | Consent |

### Data subject rights

| Right | Matrix capability |
|-------|-------------------|
| Access | User profile API + org admin export |
| Rectification | Profile update, customer record edit |
| Erasure | Soft-delete + scheduled hard purge (30-day grace) |
| Portability | JSON/CSV org export |
| Restriction | Account `inactive` flag |
| Objection | Contact DPO workflow |

### Data minimization

- Collect only fields required for service operations
- Optional fields clearly marked in API docs
- AI context snapshots exclude unnecessary PII

### Data Processing Agreement (DPA)

- Template DPA for customer organizations (B2B processor role)
- Sub-processor list maintained (hosting, email, AI provider)

### Cross-border transfers

- Prefer EU/US hosting with Standard Contractual Clauses where applicable
- Document data residency per deployment

### Breach notification

- Internal escalation within 24 hours of confirmed breach
- Customer notification within 72 hours when required (Article 33/34 assessment)
- Audit log preservation for forensic analysis

### Privacy by design checklist

- [ ] `organizationId` on all tenant data
- [ ] Soft delete before hard purge
- [ ] Audit trail on PII access
- [ ] Encryption in transit and at rest
- [ ] Role-based access to customer data
- [ ] Data retention policies configurable per org
- [ ] Cookie consent for non-essential tracking (web)
- [ ] Privacy policy and subprocessors published

### Records of processing (ROPA)

Maintain internal register documenting: data categories, purposes, recipients, retention, and safeguards. Updated on each new module (contracts, billing, training).

---

## Security development lifecycle

- Dependency scanning in CI (npm audit, Snyk or equivalent)
- Static analysis (ESLint security rules, TypeScript strict mode)
- Secret scanning on commits
- Penetration test before production multi-tenant launch
- Security review required for: auth changes, RBAC changes, new integrations, PII fields

---

## Related documents

- `docs/blueprints/MATRIX_MASTER_BLUEPRINT.md` — Roles and permission matrix
- `docs/database/ENTITY_RELATIONSHIP.md` — AuditLog and data model
- `docs/api/API_ROADMAP.md` — Auth endpoints and error codes

---

*PATCH-19 Enterprise Foundation — security specification only. No runtime changes in this patch.*
