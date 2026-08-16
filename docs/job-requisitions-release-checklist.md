# Job requisitions release checklist

Use separate Supabase projects and Vercel environments for Development, QA/Staging, and Production. Do not reuse production secrets or production data for unfinished testing.

## Required environment checks

For each environment, verify:

- `NEXT_PUBLIC_APP_URL` points to that environment.
- Supabase URL, publishable key, and service-role key belong to that environment's database.
- Authentication site URL and redirect allowlist include the environment URL and tenant subdomains.
- Tenant `slug`/`subdomain` records resolve to the expected branded portal.
- Email, Firma, storage, and any parsing credentials belong to the environment.
- `NODE_ENV` and the deployment provider's environment identifier are correct.
- Anonymous Supabase sign-in is enabled for resume-first applicants.

## Deployment order

1. Create a feature branch.
2. Deploy Development and apply the migration there.
3. Run database advisors and verify RLS, constraints, and seed templates.
4. Deploy QA/Staging and apply the same migration.
5. Run the end-to-end checklist below with fresh accounts.
6. Record QA evidence and obtain approval.
7. Deploy Production and apply the reviewed migration.
8. Run a production smoke test without modifying real applicant data.

## QA end-to-end checklist

- [ ] Create or copy a published W2/1099 workflow as an administrator.
- [ ] Create an active mapping for profession + employment type + placement type.
- [ ] Create an incomplete draft and confirm it is not public.
- [ ] Complete required fields and publish.
- [ ] Confirm the job appears under `/jobs?tenant=<slug>`.
- [ ] Open job details and click Apply.
- [ ] Confirm the first screen is resume upload and login remains optional.
- [ ] Upload a resume and confirm the application stores job, workflow, and workflow-instance IDs.
- [ ] Confirm the workflow snapshot does not change after editing the source workflow.
- [ ] Submit the application and verify recruiter job/application dashboards.
- [ ] Apply to another job with the same tenant applicant account.
- [ ] Verify the same email can be used independently in another tenant.
- [ ] Unpublish, close, and archive jobs; verify public visibility and application blocking.
- [ ] Verify recruiters receive 403 from workflow/template/mapping write APIs.
- [ ] Verify internal rates, MSP values, workflow IDs, and recruiter metadata never appear in public API responses.

Record the deployment URL, database migration version, tester, timestamp, passed checks, and failures before approving Production.
