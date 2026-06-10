-- Pre/post validation for nexusmedpro.com → brasshr.com email domain migration.
-- Run before applying 20260611120000_migrate_nexusmedpro_to_brasshr_email_domain.sql
-- and again after migration (legacy counts should be 0).

SELECT 'auth.users.email' AS source, COUNT(*) AS legacy_count
FROM auth.users WHERE lower(email) LIKE '%@nexusmedpro.com'
UNION ALL
SELECT 'auth.users.email_change', COUNT(*)
FROM auth.users WHERE lower(coalesce(email_change, '')) LIKE '%@nexusmedpro.com'
UNION ALL
SELECT 'auth.identities.email', COUNT(*)
FROM auth.identities WHERE lower(coalesce(email, '')) LIKE '%@nexusmedpro.com'
UNION ALL
SELECT 'public.users.email', COUNT(*)
FROM public.users WHERE lower(coalesce(email, '')) LIKE '%@nexusmedpro.com'
UNION ALL
SELECT 'public.worker.email', COUNT(*)
FROM public.worker WHERE lower(coalesce(email, '')) LIKE '%@nexusmedpro.com'
UNION ALL
SELECT 'public.applicants.email', COUNT(*)
FROM public.applicants WHERE lower(coalesce(email, '')) LIKE '%@nexusmedpro.com'
UNION ALL
SELECT 'public.tenants.email', COUNT(*)
FROM public.tenants WHERE lower(coalesce(email, '')) LIKE '%@nexusmedpro.com'
UNION ALL
SELECT 'public.tenants.domain', COUNT(*)
FROM public.tenants WHERE lower(coalesce(domain, '')) LIKE '%.nexusmedpro.com'
UNION ALL
SELECT 'public.worker_references.reference_email', COUNT(*)
FROM public.worker_references WHERE lower(reference_email) LIKE '%@nexusmedpro.com'
UNION ALL
SELECT 'public.zoho_sign_requests.email', COUNT(*)
FROM public.zoho_sign_requests WHERE lower(email) LIKE '%@nexusmedpro.com'
UNION ALL
SELECT 'public.documents.signer_email', COUNT(*)
FROM public.documents WHERE lower(coalesce(signer_email, '')) LIKE '%@nexusmedpro.com'
UNION ALL
SELECT 'public.candidate_communications.recipient', COUNT(*)
FROM public.candidate_communications
WHERE channel = 'email' AND lower(recipient) LIKE '%@nexusmedpro.com'
UNION ALL
SELECT 'public.email_templates.from_email', COUNT(*)
FROM public.email_templates WHERE lower(coalesce(from_email, '')) LIKE '%@nexusmedpro.com'
UNION ALL
SELECT 'public.email_templates.reply_to_email', COUNT(*)
FROM public.email_templates WHERE lower(coalesce(reply_to_email, '')) LIKE '%@nexusmedpro.com'
ORDER BY source;

-- Sample rows (up to 5 per table) for manual review before migration:
-- SELECT id, email FROM public.worker WHERE lower(email) LIKE '%@nexusmedpro.com' LIMIT 5;
