# Job Requisition ATS — Manual Test Matrix

## Valid / invalid combinations

| Job Source | Employment | Placement | Valid? | Notes |
|---|---|---|---|---|
| Internal | W2 / 1099 / Contract | Internal | Yes | Standard tenant hire |
| Internal | * | Recruit_and_Release | No | Source/placement coupling |
| Internal | * | Recruit_and_EOR | No | Source/placement coupling |
| MSP | W2 / 1099 / Contract | Recruit_and_Release | Yes | Client hire outcome |
| MSP | W2 / 1099 / Contract | Recruit_and_EOR | Yes | Requires EOR tenant |
| MSP | * | Internal | No | Source/placement coupling |

## Location type

| Location type | Street address required at publish? |
|---|---|
| On-site | Yes (address or city) |
| Hybrid | Yes (address or city) |
| Remote | No |

## Job status application gate

| Status | New applications allowed? |
|---|---|
| Draft | No |
| Pending_Approval | No |
| Approved | No |
| Published | Yes |
| Paused | No |
| Closed | No |
| Filled | No |
| Cancelled | No |

## Applicant outcome matrix

| Placement | Action | Creates payroll worker? | Creates placement record? | Final disposition |
|---|---|---|---|---|
| Internal | Convert W2/1099 | Yes | worker_assignments | converted_to_worker |
| Recruit_and_EOR | Convert W2/1099 | Yes (EOR-associated) | worker_assignments + eor_tenant_id | converted_to_worker |
| Recruit_and_Release | Hired by Client | No | client_hire_placements | hired_by_client |

## Scenario checklist

### Scenario 1 — Internal W2
1. Create Internal + W2 + Internal placement job with profession/specialty.
2. Confirm workflow assigned.
3. Approve/publish.
4. Applicant finds job via `/jobs?tenant=…` and applies.
5. Complete workflow; convert to W2.
6. Confirm worker appears under W2 workers; fill count increments.

### Scenario 2 — MSP Recruit-and-EOR
1. Select MSP placement → MSP section appears.
2. Enter source req number + EOR tenant.
3. Publish; apply; convert.
4. Confirm worker_assignments.eor_tenant_id and integration_status Pending.

### Scenario 3 — Recruit-and-Release
1. Create MSP Recruit_and_Release job; publish; apply.
2. Mark Hired by Client.
3. Confirm `client_hire_placements` row; no `workers` payroll row; candidate leaves conversion queue.

### Scenario 4 — Conditional form
1. Toggle Internal ↔ MSP → MSP section hide/show.
2. Toggle Recruitment EOR → EOR field hide/show/clear.
3. Toggle Remote → street address optional.
4. Call API with stale MSP fields on Internal job → server clears them.

### Scenario 5 — Workflow mapping
1. Create broad + specific mappings; verify specific wins.
2. Change specialty before publish → rematch.
3. Start application; edit template → applicant instance remains pinned.

### Scenario 6 — Tenant isolation
1. Tenant A staff cannot PATCH Tenant B job IDs.
2. Public job payload has no bill_rate / internal_notes.

### Scenario 7 — Position limits
1. Job with 2 positions; convert 2 candidates → remaining 0 / status Filled.
2. Third conversion blocked.

### Scenario 8 — Duplicate / retry
1. Reuse idempotencyKey on create → single job.
2. Retry convert → no duplicate worker/placement.

### Scenario 9 — Closed job
1. Close published job; public apply returns JOB_INACTIVE.
2. Existing applicants can still open their application.

### Scenario 10 — Applicant navigation
1. Complete/skip/resume steps; farthest-reached enforced (existing onboarding tests).
