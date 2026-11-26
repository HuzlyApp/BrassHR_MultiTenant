# Security implementation — 26 November 2026

Scope: the Security tab of the BrassHR QA workbook. CAPTCHA (SEC-C09), CAPTCHA hooks, challenge pages and Attack Challenge Mode are explicitly excluded by Carl. Original tester results are preserved; developer implementation and evidence are tracked separately.

## Implemented controls

- SEC-P01: exact-label `public_tenant_branding` RPC returns only an explicit list of presentation fields. Anonymous table privileges and broad active-tenant policy are removed in a separately ordered migration. Private tenant rows require active Admin/HR membership in that company (or the platform operator). Company writes go through the staff-authorized business-info API. Branding, hostname, tenant ID and favicon consumers use the bounded RPC; the default lookup never picks an arbitrary customer.
- SEC-P02 / SEC-C01 / SEC03–SEC05: `current_tenant_id` rejects anonymous claims, inactive accounts and explicitly suspended memberships. Existing protected user-column trigger prevents changing role, tenant, activation or god-admin flags through the SDK. Fresh server membership/permission checks remain authoritative. `supabase/tests/security_tenant_boundary.sql` verifies real privileges without emitting customer records and rolls the transaction back. Destructive two-tenant fixtures run only in a protected, dedicated QA database, never shared staging.
- SEC-P06: browser camera/microphone/speaker/autoplay permission is scoped to self and the approved Dialpad embed origins; screen capture is disabled; geolocation is self-only.
- SEC-P07 / SEC-C11: unpredictable per-request nonces with strict-dynamic; no inline/eval script allowance in production; connections limited to configured Supabase HTTP/WebSocket, Firma, Dialpad, Mapbox and Vercel telemetry. Inline styles remain necessary for the existing UI. Root rendering is dynamic to prevent nonce reuse; public job framing remains intentionally allowed. Firma's injected patch and bundle and job JSON-LD receive the nonce. Third-party signing and telephony still need signed-in browser acceptance testing.
- SEC-P08: cross-origin mutations to cookie-authenticated private APIs are denied; private API responses use no-store and omit wildcard credential CORS. Public homepage CORS is not a substitute for endpoint authorization. Native clients without Origin remain subject to normal token/session checks.
- SEC-B02 / SEC02 / BUG-302: a failed profile load hides the candidate shell, tabs, children and download actions. Both unknown and inaccessible records show the same generic message.
- CHK-error-page / BUG-303: an unmapped staff page produces a generic HTTP 404 instead of redirecting to a denied dashboard. Known denied modules remain forbidden.
- SEC-B03 / SEC-C04 / SEC06: central private-document signing defaults to 120 seconds and clamps callers to 60–300 seconds. Stored signed URLs are re-signed, not passed through; signing failure cannot fall back to a private bucket's public URL. Legacy worker profile/checklist/onboarding and portal signing calls use the short TTL. A bearer URL already issued cannot be revoked by logout; its bounded lifetime remains the residual window.
- SEC-C03 / SEC-C19: licence identifiers are masked in staff profile/list responses. Identity document links and general candidate attachment links require current Admin/HR permissions; other staff retain resume access and metadata. The account-file endpoint checks staff sensitive access independently of the People grant, while applicants retain access only to their own records. Issuance records actor, tenant, worker, source and document ID without bearer URLs. An issuance event is not proof the file was actually downloaded. Full identifier reveal is not introduced merely to satisfy a checklist.
- SEC-C05 / CHK-upload-validation: portal and legacy required-file uploads reject executable content renamed to allowed PDF/image/Word extensions using server byte checks, size/type gates, UUID names and non-overwriting writes. DOCX additionally requires a Word document entry. This is type validation, not antivirus; approved malware scanning/quarantine remains required before calling the control complete. Legacy onboarding prefixes remain supported; migrating all historical objects to tenant-prefixed paths is pending.
- SEC-P05 / SEC-C07: login OTP send and verify have independent IP, email and IP+email buckets, so rotating one dimension cannot bypass the other. Shared limiter outages fail closed where configured. Direct Supabase password-grant traffic bypasses this app API and still requires provider Auth rate-limit settings; do not claim otherwise.
- SEC-C08: Vercel auth-abuse monitoring rule uses a 60-second, 150-per-IP window on POST /api/auth/. It starts in log mode as required for safe tuning; app limits perform enforcement. No challenge/CAPTCHA action. Preserve platform automatic DDoS mitigation. Review legitimate traffic before switching this rule to deny/rate-limit; do not load-test production.
- SEC-C06: existing password plus mandatory email OTP proof is bound to a verified user/session ID and checked by staff API authorization, including Admin/HR. Password-only sessions and a proof copied between sessions fail tests. Enrolled authenticator factors require AAL2. Mandatory TOTP/passkey enrollment for every privileged account is a separate rollout, not claimed complete.
- SEC-P04 / SEC-C10: anonymous Auth is deliberately retained for the existing applicant intake flow. It never confers staff membership; disabling it globally would break intake. Tenant/staff invitations use authoritative membership, not user_metadata. Provider-wide owner signup remains required for tenant registration; staff access stays invitation/membership controlled.
- SEC-P10 / SEC-C18: The prepared CI workflow runs source-secret scanning, security/unit regression and type checking when activated; browser service-role import and public-key exposure guards remain. Known dummy assignments in tests are exempt only from the generic assignment heuristic, not provider-key/JWT/private-key signatures. Generated QA reports are excluded from source scans.
- SEC08: approval tests verify duplicate-click prevention, denial, failure responses and persisted success; desktop/mobile duplicate DOM labels are selected unambiguously.

## Release and rollback

1. Apply `security_public_branding_lookup` to the confirmed project qowirmiicsrglehiaoil; verify a safe anonymous result without private keys.
2. Apply `security_active_tenant_context`; verify anonymous scope is null. Keep anonymous execute permission on this null-returning helper so public policies do not fail from function permission errors.
3. Deploy the application consumers and validate login/public branding on the exact new staging commit.
4. Apply `security_tenant_data_boundary`, then run the rollback-only SQL boundary check and recheck public branding. Never run the blanket CLI db push against a stale project link.
5. Roll back application consumers only if the bounded RPC remains available. If company permission compatibility requires a temporary repair, keep anonymous table access revoked; use a narrowly scoped authenticated policy rather than restoring public enumeration. Database changes must be a new migration, never editing an applied historical migration.

No root workspace resume edits are included. Changes originate on a separate feature branch and are backported to pulled development independently of unrelated staging history. Use HENERALPEPITO <clelipan@up.edu.ph> as author/committer.

## Remaining implementation and operational acceptance

These are real remaining requirements, not QA passes:

| Controls | Required evidence / remaining action | Owner |
|---|---|---|
| SEC-C02 | Encrypted licence envelope/display-suffix columns, direct-read restrictions, a plaintext-write guard, masked readers and a tenant-scoped dry-run/apply backfill are implemented. Run the backfill with the approved per-environment field key and retain audit/rollback evidence; inventory other credential fields. Current app uses SSN last-four and encrypted payroll fields; this does not prove all licence columns encrypted. Never re-use a public key or store encryption keys in SQL/migrations. | Engineering + security owner |
| SEC-C03/C19 | Finish audit coverage and custom designated-role grants across every legacy attachment/onboarding/export path; prove direct SDK/storage cannot bypass the API gate. Add an explicit, audited, time-bound reveal only for an approved business need. | Engineering + QA |
| SEC-C05 | Provision approved malware scanner, quarantine and release/deny workflow; validate an innocuous scanner fixture in dedicated QA. No new external upload service receives PII without vendor approval. | Infrastructure + security owner |
| SEC-P05/C07 | Verify Supabase Auth per-IP/token/email controls and hosted limits against direct password grants with a controlled QA account. Log-mode WAF is observation, not enforcement. | Supabase/Vercel operator |
| SEC-P09/CHK-cookie-flags | Supabase SSR browser SDK currently needs readable refresh cookies (Secure in production, SameSite=Lax). Staff OTP proof is HttpOnly. Moving all refresh credentials to HttpOnly requires a BFF/session architecture and browser integration tests; toggling the flag alone breaks refresh. | Engineering |
| SEC-P12/B05/B06/SEC01/SEC04/SEC05/SEC06/CHK-open-redirect | Run signed-in two-tenant, role revocation/suspension, expiry, upload and redirect acceptance flows using controlled accounts; BUG-304 signed-in login-loop observation is not reproduced by unauthenticated checks. Existing automated session/redirect tests do not establish a live browser pass. | QA |
| SEC09/SEC10/SEC11/SEC12 | Re-test interrupted upload, responsive empty filters, source application timestamps in Eastern time, and independent multi-application phase history on controlled fixtures. Preserve original QA statuses until done. | QA |
| SEC07/CHK-xss/CHK-export | Preserve public/export field projections and sanitizers; re-test each signed-in export/search against controlled PII canaries. | QA |
| SEC-C12–C18/C20 | Complete the operational evidence described below; a written runbook is not a restore, contract, incident drill, certification or independent test. | Assigned business/security owners |

## SEC-C12 — backup and restore procedure

Inventory database, Auth, private object storage and environment/key backups separately. Confirm provider plan, encryption, region, retention and PITR capabilities in the actual account; do not infer these from source. Set business-approved RPO and RTO before production acceptance. Database snapshots do not automatically establish object-storage recovery.

Run a restore into an isolated project with email/SMS/webhooks disabled, separate credentials, access restricted and no public URLs. Restore representative encrypted fields using the approved recovered key, tenant boundaries, Auth identity links and private file objects. Re-run the two-tenant security suite. Record source backup ID/time, restore target, start/end, measured RPO/RTO, row/object integrity, decryption test, authorization results, operator and approver. Securely remove the isolated copy after approval. Schedule quarterly drills and after material schema/auth changes. **Restore execution and measured recovery targets are pending.**

## SEC-C13 — retention and deletion procedure

A business/legal owner must approve durations separately for candidate applications, hired-worker records, identity/compliance files, messages, audit logs and backups. Keep legal holds per tenant/record; a hold always prevents purge. Until approved, do not run automated deletion against customer records.

Deletion implementation must support a dry-run tenant-scoped inventory, authenticated admin authorization and audit, hold checking, export/approval where required, deletion of all dependent storage objects and DB rows, retryable tombstones for partial storage failures, cache invalidation and a backup-expiry record. Test with disposable fixtures and injected storage failure before scheduling. Soft-deactivating a staff account is not PII erasure. **Policy approval and purge implementation remain pending.**

## SEC-C14 — incident response procedure

Assign incident commander, engineering lead, privacy/legal reviewer, customer liaison and vendor escalation contacts in the restricted operations directory. Do not commit personal contact details or secrets. On suspected PII exposure: preserve restricted evidence/timeline, assess affected tenants without exporting unnecessary PII, contain exposure (revoke sessions/keys, isolate routes), remediate and verify, then restore service under review. Legal/privacy owners determine applicable jurisdictions, contractual notification deadlines and message content; this document does not invent one universal deadline. Keep communications approved and an immutable incident record. Rehearse a tenant-exposure tabletop and record actions and follow-up. **Named contacts and a completed drill remain pending.**

## SEC-C15 — vendor register and contract review

Register Supabase (DB/Auth/storage), Vercel (hosting/logs), Firma (signing), Dialpad (telephony), Resend (email), Twilio (SMS), Mapbox (maps), Upstash/Redis (cache), and every configured AI provider used for resumes/job matching (including Anthropic, Gemini, XAI/Grok and others actually enabled). For each: purpose, data categories, tenant scope, region, subprocessors, retention/deletion, breach contact, DPA/version, approved transfer terms, and BAA when required for the business's HIPAA use case. Apply data minimization to AI prompts and log drains. Obtain security/legal approval before processing regulated data. **Executed DPAs/BAAs and approval evidence are not established by an SDK dependency.**

## SEC-C16 — audit and monitoring procedure

Use the existing activity log and security-auth events, scoped by tenant, rather than a duplicate logging system. Capture reads, document-link issuance, reveals, exports, permission changes, session revocation and failed auth; never log passwords, OTPs, SSNs, signed URLs or bearer tokens. Restrict log reads to authorized security/admin roles and keep write/delete access server-only. Set an approved retention period and alert destination; detect spikes in failures/downloads/exports, repeated cross-tenant denials, privilege changes and logging failures. Test a synthetic alert and receipt. **External alert routing, immutable retention and exhaustive coverage require operational acceptance.**

## SEC-C17 — readiness mapping

Map tenant/role controls and MFA to access management; source scanning and CI to change management; private storage/encryption to data protection; audit/alerts to monitoring; restore drills to availability; incident tabletop to response; vendor contracts to supplier management; retention/legal holds to data lifecycle. Attach concrete dated evidence, responsible owners and remediation tracking for every gap. Engage an appropriate independent assessor and counsel for applicable scope. **No SOC 2 report, HIPAA compliance or certification is claimed.**

## SEC-C18 — key rotation procedure

Maintain a restricted inventory of provider keys, scopes, environment, owner and rotation history. Rotate on suspected exposure, provider guidance, privileged-staff exit and an approved recurring schedule. Create a replacement with minimum scope, stage it in the secret manager, deploy and smoke test each dependent service, revoke the old key, and verify old-key rejection. Encryption-key rotation requires key versioning and a verified re-encryption/rollback plan before retiring the old key. Never print secrets into CLI output or put them in Git/Sheets. **No blanket live key rotation was performed.**

## SEC-C20 — independent testing handoff

Provide the assessor written scope covering approved domains/projects, two disposable tenants, Admin/HR/Manager/Recruiter/Applicant roles, direct Supabase endpoints, storage, invitation/reset/OTP, exports and uploads. Include rules of engagement, rate/availability limits, data handling, emergency contacts and a retest requirement. Prohibit production flooding and customer PII harvesting. Deliver the current control matrix and known remaining gaps. **Procurement, independent testing and signed report are outstanding.**

## Validation record

See the release evidence recorded in the Security tab developer columns and the QA output produced for this branch. Distinguish local source checks, database privilege checks and signed-in browser acceptance. Destructive live RLS fixtures are intentionally skipped unless a dedicated QA project is explicitly configured. CAPTCHA remains excluded from every category.


## SEC-C02 — controlled licence encryption backfill

Apply `security_encrypted_license_fields` before the new readers. It adds an encrypted envelope and display suffix, removes direct anonymous/authenticated access to full identifiers, and prevents new plaintext writes. Existing deprecated licence-create APIs remain disabled; any future writer must use the existing `encryptField` helper and save only ciphertext plus a suffix.

Run `node --conditions=react-server scripts/security-encrypt-licenses.mjs` in the approved Node 24 operations environment with `SECURITY_BACKFILL_TENANT_ID`, `SECURITY_BACKFILL_EXPECTED_HOST`, Supabase server credentials and the existing `PAYROLL_DATA_ENCRYPTION_KEY`. The default run returns counts only. Retain a recoverable backup and an approved key-recovery plan, then run with `--apply` per tenant. Optimistic timestamp checks prevent overwriting concurrent edits; completion requires zero remaining plaintext rows and a tenant audit record. No plaintext or encryption key is logged. Ciphertext remains decryptable with the existing key; do not restore plaintext columns as rollback. **The target project inventory returned zero licence rows and zero plaintext identifiers, so no live backfill was needed. Field inventory outside this table remains outstanding.**


Validation at release preparation: full suite 3,557 passed / 22 dedicated-live-RLS tests skipped; final focused security set 64 passed / 22 skipped, including encryption, masked display, rate dimensions, upload rejection and unresolved/denied profile actions. Source secrets scan passed. Clean installation of the locked dependencies reported zero npm vulnerabilities. Full production build and remote deployment evidence are recorded separately after completion; compile-only success is not a complete deployed-flow test. An earlier timing-sensitive legal-editor test passed on isolated rerun and the subsequent full suite passed.


Release validation also exposed existing Next App Router entry-point type errors: shared workflow/template/sign-in components were exported from route entry files, two route files exported runtime helpers, and a GET handler had an optional first Request parameter. Shared components are now in sibling feature modules with thin page entry points, the existing scheduling contract supplies OFF_TYPES, and helper/request types follow the route contract. Rendered behavior and permissions are preserved; related regressions and the generated route types are checked before publishing.


CI activation is pending: GitHub rejected the atomic publication because the connected OAuth app lacks workflow scope. The complete definition is preserved at `docs/security/ci-workflow.yml`; an authorized repository owner can install it at `.github/workflows/security.yml`. No CI execution is claimed until that installation is completed. Application changes are published independently using existing Git permissions.


Follow-up storage review found that the tenant-prefix policy could bypass API-only role checks for `worker_required_files`. The new `security_sensitive_storage_roles` migration restricts direct tenant-prefixed identity object reads/updates to active, non-anonymous Admin/HR membership (or an active platform operator) with a verified AAL2 token. Normal application APIs continue signing only after their server-side staff OTP checks, keeps self-owned object access, and validates UUID prefixes before casting. Other buckets and new-object insert paths retain their existing boundaries. A dedicated two-tenant adversarial check covers Admin, recruiter, worker and foreign membership. Legacy API/document-path acceptance remains separately tracked; this does not establish antivirus coverage.
