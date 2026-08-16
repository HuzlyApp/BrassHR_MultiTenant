/**
 * @deprecated Replaced by AddCandidateModal.tsx (Figma upload + paste resume tabs).
 * The legacy full-page manual form lived here; route /add-candidate now redirects to listing.
 *
 * Previous flow:
 * - Full-page form with job select, name/email/phone, file upload, address, employment
 * - POST /api/admin/job-applications (no resume parsing)
 *
 * New flow:
 * - Modal on candidates listing with Select Files | Paste Resume Text tabs
 * - POST /api/admin/add-candidate-from-resume (Grok parse + job application create)
 */

export {};

/* LEGACY AddCandidateClient — kept commented for reference
"use client";
... entire previous implementation ...
*/
