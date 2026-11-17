# BrassHR Inbound Integration API

Instructions for an AI or integration client that creates and looks up jobs and candidates in one BrassHR tenant. Follow this contract exactly. Do not invent endpoints, fields, or bulk-export calls.

Replace `YOUR_DOMAIN` with the tenant's BrassHR host and `YOUR_API_KEY` with a key a staff admin created in **Settings → Integrations**. Keys look like `bhr_in_…`. The plaintext key is shown once at creation. This API cannot create or revoke keys.

## Rules

1. Send the key on every request as exactly one of:
   - `Authorization: Bearer YOUR_API_KEY`
   - `X-API-Key: YOUR_API_KEY`
2. If both headers are present, they must be the same key. Different values return `401`.
3. The key already selects the tenant. Send `X-Tenant-Id` only when you know that tenant's id, and it must match the key. A mismatch returns `403`.
4. There is no list or export endpoint. `GET /api/v1/jobs` and `GET /api/v1/applicants` are errors. Search one record at a time.
5. Creating a job with an `external_req_id` that already exists returns the existing job. It does not update that job.
6. A resume must contain a parseable name and email. Phone alone is not enough. The API does not accept name or email as separate form fields.
7. On `429`, wait the number of seconds in `Retry-After`, then retry that request once. On `503` from resume storage, retry once. Do not retry `400`, `401`, `403`, `404`, `413`, or `422` without changing the request.
8. Do not log or repeat the API key.

Approximate limits: 300 auth attempts per minute per caller, 60 writes per minute per key, 120 searches per minute per key.

## Error body

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "field": "location", "message": "location is required for MSP jobs" }]
  }
}
```

| HTTP | `error.code` | Meaning | What to do |
| --- | --- | --- | --- |
| 401 | `UNAUTHORIZED` | Missing or invalid key | Stop. Ask a human for a new key. |
| 403 | `FORBIDDEN` | Key is for a different tenant, or the key scope is not `inbound` | Stop. Do not retry with another tenant id. |
| 400 | `VALIDATION_ERROR` | Bad JSON, missing fields, or wrong search query | Fix the body or query using `details`, then resend. |
| 404 | `NOT_FOUND` | Search found nothing, or `job_id` / `external_req_id` does not exist in this tenant | For search, treat as not found. For resume upload, create the job first or drop the job link. |
| 413 | `PAYLOAD_TOO_LARGE` | Resume is over 10 MB | Send a smaller file. |
| 422 | `UNPROCESSABLE` | Resume has no usable name or email | Do not invent an email. Ask for a resume that includes both. |
| 429 | `RATE_LIMITED` | Too many requests | Wait `Retry-After` seconds, then retry once. |
| 503 | `SERVICE_UNAVAILABLE` | Resume storage failed | Retry once. |
| 500 | `INTERNAL` | Unexpected failure | Stop and report the `message`. Do not guess a success. |

Search misses return `404` with `{ "found": false }`, not the error body above.

## 1. Create a job

`POST /api/v1/jobs`

`Content-Type: application/json`

`source_type` defaults to `MSP`.

MSP jobs require:

| Field | Values / notes |
| --- | --- |
| `employment_type` | `W2`, `1099`, or `Contract` |
| `title` or `public_title` or `source_job_title` | At least one |
| `profession` | Required for MSP |
| `external_req_id` or `external_requisition_id` | Required for MSP. Also the idempotency key. |
| `location` | Required for MSP, for example `Dallas, TX` |
| `placement_type` | `Internal`, `Recruit_and_Release`, or `Recruit_and_EOR`. MSP defaults to `Recruit_and_Release`. |

Internal jobs (`"source_type": "Internal"`) require `employment_type` and a title. They do not require profession, external id, or location.

Optional: `status` (`draft` default, `open`, or `published` which is stored as `open`), `description` or `public_description`, `source_description`, `msp_name`, `msp_client_name`, `facility_name`, `location_type`, `pay_rate`, `bill_rate`, `rate_unit`, `number_of_positions` (default 1), `job_duration`, `target_start_date`, `expected_hours`, `years_of_experience`, `source_job_url`, `internal_requisition_number`, `benefits` (string or array of strings), `internal_notes`, `specialty`, `job_source_code`.

`job_source_code` must already exist as an active BrassHR job source. An unknown code fails the request. Omit it when you do not have one.

`description` may be HTML or plain text. Allowed tags: `p`, `br`, `strong`, `b`, `em`, `i`, `ul`, `ol`, `li`. Other tags and attributes are removed. Plain text is turned into paragraphs.

New job: HTTP `201` and `"created": true`. Existing `external_req_id`: HTTP `200` and `"created": false`.

```bash
curl -X POST "https://YOUR_DOMAIN/api/v1/jobs" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "employment_type": "W2",
    "title": "Registered Nurse - ICU",
    "profession": "Nursing",
    "external_req_id": "REQ-12345",
    "location": "Dallas, TX",
    "status": "open",
    "description": "<p>Provide <strong>ICU</strong> nursing care.</p><ul><li>Active RN license</li></ul>"
  }'
```

```json
{
  "id": "8f3c2a1b-0000-4000-8000-000000000000",
  "external_req_id": "REQ-12345",
  "title": "Registered Nurse - ICU",
  "status": "open",
  "created": true
}
```

Minimal MSP body:

```json
{
  "employment_type": "W2",
  "title": "Registered Nurse - ICU",
  "profession": "Nursing",
  "external_req_id": "REQ-12345",
  "location": "Dallas, TX"
}
```

Internal body:

```json
{
  "source_type": "Internal",
  "employment_type": "W2",
  "title": "Staff Accountant",
  "status": "open",
  "location": "Remote",
  "description": "<p>Full-time accounting role.</p>"
}
```

## 2. Find one job

`GET /api/v1/jobs/search`

Send exactly one query parameter: `id` (BrassHR UUID), `external_req_id`, or `title`. `title` is an exact match on the public title. Extra parameters return `400`.

```bash
curl "https://YOUR_DOMAIN/api/v1/jobs/search?external_req_id=REQ-12345" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Found (`200`):

```json
{
  "found": true,
  "id": "8f3c2a1b-0000-4000-8000-000000000000",
  "external_req_id": "REQ-12345",
  "title": "Registered Nurse - ICU",
  "status": "open",
  "created_at": "2026-11-10T01:00:00.000Z"
}
```

Not found (`404`): `{ "found": false }`

## 3. Upload a resume

`POST /api/v1/applicants/resume`

`Content-Type: multipart/form-data`. This is not a JSON endpoint.

| Field | Required | Notes |
| --- | --- | --- |
| `file` | Yes | Resume file, preferably `.pdf`, `.docx`, or `.txt`. Max 10 MB. |
| `job_id` | No | BrassHR job UUID. If present, it is used and `external_req_id` is ignored. |
| `external_req_id` | No | Link the application to the job with this external id. |
| `source` | No | Label stored with the resume, for example `iLabor`. |
| `work_city` | No | Use with a job link when the resume has no city. |
| `work_state` | No | Use with a job link when the resume has no state. |
| `will_relocate` | No | `true` or `1` means the candidate will relocate. |

The file is parsed for name, email, and phone. The candidate's application source is `Uploaded via API`. If the email already exists in the tenant, the existing candidate is updated and `created` is `false` (HTTP `200`). A new candidate returns HTTP `201`.

If `job_id` or `external_req_id` is sent and that job does not exist, the upload fails with `404`. Create or search the job first. Omit both fields to store the candidate without an application.

A resume that cannot produce a name and email returns `422`. The file may be stored for manual review, but no candidate is created.

```bash
curl -X POST "https://YOUR_DOMAIN/api/v1/applicants/resume" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@./resume.pdf" \
  -F "external_req_id=REQ-12345" \
  -F "source=iLabor" \
  -F "work_city=Dallas" \
  -F "work_state=TX" \
  -F "will_relocate=true"
```

```json
{
  "applicant_id": "00000000-0000-4000-8000-000000000000",
  "email": "jane.doe@example.com",
  "phone": "+15551234567",
  "full_name": "Jane Doe",
  "resume_document_id": "00000000-0000-4000-8000-000000000001",
  "linked_job_id": "8f3c2a1b-0000-4000-8000-000000000000",
  "application_id": "00000000-0000-4000-8000-000000000002",
  "created": true
}
```

`linked_job_id` and `application_id` are `null` when no job was linked. `warnings` may be present when the resume text quality is low.

## 4. Find one applicant

`GET /api/v1/applicants/search`

Send exactly one of `email` or `phone`. Sending both, or neither, returns `400`.

```bash
curl "https://YOUR_DOMAIN/api/v1/applicants/search?email=jane.doe%40example.com" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Found (`200`):

```json
{
  "found": true,
  "applicant_id": "00000000-0000-4000-8000-000000000000",
  "email": "jane.doe@example.com",
  "phone": "+15551234567",
  "full_name": "Jane Doe",
  "created_at": "2026-11-10T01:00:00.000Z"
}
```

Not found (`404`): `{ "found": false }`

## Usual order

1. Create the job with a stable `external_req_id`, or search to confirm it already exists.
2. If `created` is `false`, keep using that `id` and `external_req_id`. Do not send a second create to change fields.
3. Upload the resume with the same `external_req_id` or the returned job `id`.
4. Search the applicant by the email parsed from the resume when you need to confirm the record.
