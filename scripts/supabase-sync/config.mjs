/**
 * One-way prod → staging synchronization config.
 * Staging = BrassHR_South. Production = BrassHR.
 * Never reverse this direction.
 */

export const PRODUCTION_PROJECT_REF = "avhdoifnsnoeavqxnwwm";
export const STAGING_PROJECT_REF = "mgucromvpnxntwyssltd";

/** Legacy alias used elsewhere in the repo */
export const DEVELOPMENT_PROJECT_REF = STAGING_PROJECT_REF;

/**
 * Category 2: approved reference / configuration tables.
 * Only these tables may have rows synced prod → staging.
 * Upsert by primary key; no truncate unless marked replaceable.
 */
export const PROD_TO_STAGING_DATA_SYNC_ALLOWLIST = [
  "signup_us_states",
  "signup_us_cities",
  "reference_us_timezones",
  "skill_categories",
  "skill_questions",
  "onboarding_step_library",
  "workflow_templates",
  "email_templates",
  "faqs",
];

/** Allowlist tables that may be fully replaced (truncate + insert) on staging */
export const REPLACEABLE_REFERENCE_TABLES = [
  "signup_us_states",
  "signup_us_cities",
  "reference_us_timezones",
];

/**
 * Category 1: schema-only (structure/RLS/indexes). Never sync rows.
 * Listed for documentation / CI deny checks — not exhaustive of all PII tables.
 */
export const SCHEMA_ONLY_TABLES = [
  "tenants",
  "users",
  "user_roles",
  "worker",
  "workers",
  "applicants",
  "applicant_messages",
  "candidate_communications",
  "agreements",
  "worker_firma_signing_sessions",
  "zoho_sign_requests",
  "activity_log",
  "job_requisitions",
  "applicant_requisitions",
  "client_hire_placements",
  "support_tickets",
  "support_ticket_messages",
  "worker_resumes",
  "worker_documents",
  "auth_login_otps",
  "applicant_continuation_links",
];

/** Non-sensitive static Storage path prefixes allowed for optional object sync */
export const STORAGE_OBJECT_SYNC_ALLOWLIST = [
  "public/system-assets/",
  "public/default-templates/",
  "public/reference-images/",
];

export const DESTRUCTIVE_SQL_PATTERNS = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bDROP\s+POLICY\b/i,
  /\bDROP\s+FUNCTION\b/i,
  /\bDROP\s+TRIGGER\b/i,
  /\bDROP\s+BUCKET\b/i,
  /\bTRUNCATE\b/i,
  /\bALTER\s+TABLE\b.+\bALTER\s+COLUMN\b.+\bTYPE\b/i,
  /\bDISABLE\s+ROW\s+LEVEL\s+SECURITY\b/i,
];

/**
 * @param {string} sourceRef
 * @param {string} destRef
 */
export function assertProdToStagingDirection(sourceRef, destRef) {
  const source = String(sourceRef || "").trim();
  const dest = String(destRef || "").trim();

  if (!source || !dest) {
    throw new Error("Source and destination project refs are required.");
  }
  if (source === dest) {
    throw new Error("Source and destination Supabase refs must be different.");
  }
  if (source !== PRODUCTION_PROJECT_REF) {
    throw new Error(
      `Refused: source must be production (${PRODUCTION_PROJECT_REF}), got ${source}.`
    );
  }
  if (dest !== STAGING_PROJECT_REF) {
    throw new Error(
      `Refused: destination must be staging (${STAGING_PROJECT_REF}), got ${dest}.`
    );
  }
  if (dest === PRODUCTION_PROJECT_REF) {
    throw new Error("Refused: never write synchronization into production.");
  }
}

/**
 * @param {string} sql
 */
export function findDestructiveOperations(sql) {
  const hits = [];
  for (const pattern of DESTRUCTIVE_SQL_PATTERNS) {
    if (pattern.test(sql)) hits.push(pattern.toString());
  }
  return hits;
}

/**
 * @param {string} table
 */
export function isAllowlistedForDataSync(table) {
  return PROD_TO_STAGING_DATA_SYNC_ALLOWLIST.includes(table);
}

/**
 * @param {string} table
 */
export function isSchemaOnlyTable(table) {
  return SCHEMA_ONLY_TABLES.includes(table);
}
