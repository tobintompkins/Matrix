# Data Quality Center (Patch 50C-1)

## Architecture

The Data Quality Center lives under `/admin/data-quality` and uses:

- Prisma models: `DataQualitySetting`, `DataQualityRule`, `DataQualityIssue`, `DataQualityScan`, `DataMergeHistory`, `DataQualitySnapshot`
- Services in `lib/data-quality/`
- APIs under `/api/data-quality/*`
- Existing AdminShell, audit, notifications, Approval Center, Organization Health, CRM, machines, inventory, portal, and approvals systems

**Scans are read-only.** Detection never mutates source business records. Fixes and merges are separate, permission-protected, transactional operations.

## Data Health Score

Server-side 0–100 score with configurable dimension weights (defaults):

| Dimension | Weight |
|-----------|--------|
| Completeness | 30% |
| Validity | 25% |
| Uniqueness | 20% |
| Relationship Integrity | 15% |
| Timeliness | 10% |

Classification thresholds: Excellent ≥95, Healthy ≥85, Needs Attention ≥70, At Risk ≥50, else Critical.

Missing/unsupported modules are excluded safely. Optional fields are not treated as required defects.

Calculation version: `50C1.1` (stored on scans/snapshots).

## Issue types / severity / status

Issue families include `DUPLICATE`, `MISSING_REQUIRED_VALUE`, `INVALID_VALUE`, `ORPHANED_RECORD`, `BROKEN_RELATIONSHIP`, and related types.

Severity: `CRITICAL` | `HIGH` | `MEDIUM` | `LOW` | `INFO`

Status: `OPEN` | `ASSIGNED` | `IN_REVIEW` | `FIX_PENDING` | `RESOLVED` | `DISMISSED` | `FALSE_POSITIVE` | `REOPENED`

## Rules

Rules are declarative JSON configuration. `CUSTOM_SERVER_RULE` may only reference registered server handlers — arbitrary SQL/JS is rejected.

System rules are seeded idempotently (`ensureSystemRulesSeeded`) and never overwrite administrator-edited rows.

## Scan lifecycle

1. Permission check (`RUN_DATA_QUALITY_SCAN`)
2. Create `DataQualityScan` (`RUNNING`)
3. Run detectors (`detectDataQualityFindings`) — read-only
4. Upsert issues by `issueKey` (no duplicate open issues)
5. Reopen previously resolved issues if the defect returns
6. Mark scan `COMPLETED` / `FAILED`
7. Audit events written

No background scheduler is claimed. Automatic scan settings display that scheduling is unavailable.

## Duplicate detection

Normalized exact matching (case, whitespace, punctuation) for customers, machines, and parts. Fuzzy matching is not used for auto-merge. Confidence scores are stored on findings.

## Cleanup and automated fixes

Safe fixes only (registered server-side), currently including whitespace trim on customer names. High-risk changes (inventory qty, merges, permission removal, meter alteration) are blocked from automated fix paths.

Cleanup is guided via the issue detail page and merge wizard — not a generic database editor.

## Merge workflow

Supported entities: Customer, Machine, Part.

1. Preview comparison
2. Confirm + reason
3. Customer merges submit an Approval Center `GENERAL_REQUEST`
4. Duplicate is archived through existing admin archive services
5. `DataMergeHistory` recorded
6. Related open duplicate issues resolved

Cross-organization merge is prevented by organization-scoped APIs and archive services.

## Permissions

See `VIEW_DATA_QUALITY_*`, `RUN_DATA_QUALITY_SCAN`, rule/issue/fix/merge/export/settings keys in `lib/auth/types.ts`. Every route enforces permissions server-side via `forbidUnless`.

## Organization Health integration

`getOrganizationHealthSummary` includes a `dataQuality` aggregate (`dataHealthScore`, critical/duplicate/missing/orphaned counts) and link `/admin/data-quality`.

## Approval Center integration

Major customer merges create Approval Center requests via `submitApprovalFromModule`. High-risk inventory quantity automation remains blocked.

## Customer Portal safety

Portal membership checks detect missing customer access without exposing private portal payloads in non-sensitive issue views.

## Audit / notifications

Privileged actions write admin audit events. Assignment and related events use the existing notification framework (`DATA_QUALITY_*` types).

## Known limitations

- No background job scheduler for automatic scans
- Merge rollback is not supported (`rollbackStatus: NOT_SUPPORTED`)
- Contact/location merge not in initial supported set
- Fuzzy duplicate matching is conservative / not used for auto-merge
- Safe automated fix registry is intentionally small

## Rule dictionary (examples)

### Duplicate Machine Serial Number

- **Module:** Machines
- **Severity:** Critical
- **Detection:** Two or more active machines in the same organization share a normalized serial number
- **Automated fix:** Not allowed
- **Resolution:** Review machine records; correct the invalid serial or merge via the merge wizard

### Negative Inventory On Hand

- **Module:** Inventory
- **Severity:** Critical
- **Detection:** Balance `quantityOnHand` is negative
- **Automated fix:** Not allowed (requires authorized inventory correction)
- **Resolution:** Use existing inventory correction workflow with reason and audit
