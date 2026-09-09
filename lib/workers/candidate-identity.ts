import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeTenantEmail } from "@/lib/tenant/tenant-email-uniqueness";
import { queryInChunks } from "@/lib/supabase/chunked-in-query";

/** Digits-only phone for identity matching (requires at least 10 digits). */
export function normalizeCandidatePhone(phone: string | null | undefined): string {
  return String(phone ?? "").replace(/\D/g, "");
}

export function normalizeCandidatePersonName(
  firstName: string | null | undefined,
  lastName: string | null | undefined
): string {
  return `${String(firstName ?? "").trim()} ${String(lastName ?? "").trim()}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type CandidateIdentityFields = {
  id?: string | null;
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  created_at?: string | null;
  applied_job_count?: number | null;
};

/**
 * Stable identity key for candidate-profile dedupe.
 * Prefer email; otherwise phone (last 10 digits) + full name.
 */
export function candidateIdentityKey(row: CandidateIdentityFields): string | null {
  const email = normalizeTenantEmail(String(row.email ?? ""));
  if (email) return `email:${email}`;

  const phone = normalizeCandidatePhone(row.phone);
  const name = normalizeCandidatePersonName(row.first_name, row.last_name);
  if (phone.length >= 10 && name) return `phone-name:${phone.slice(-10)}:${name}`;
  return null;
}

/** Phone+name bridge key used to merge blank-email duplicates into emailed candidate profiles. */
export function candidatePhoneNameKey(row: CandidateIdentityFields): string | null {
  const phone = normalizeCandidatePhone(row.phone);
  const name = normalizeCandidatePersonName(row.first_name, row.last_name);
  if (phone.length >= 10 && name) return `${phone.slice(-10)}:${name}`;
  return null;
}

function scoreCandidateProfile(row: CandidateIdentityFields): number {
  const hasEmail = normalizeTenantEmail(String(row.email ?? "")) ? 1000 : 0;
  const apps = Number(row.applied_job_count ?? 0);
  const created = row.created_at ? Date.parse(row.created_at) : 0;
  return hasEmail + apps * 10 + (Number.isFinite(created) ? created / 1e13 : 0);
}

/** Pick the best worker row to keep as the candidate profile within a duplicate group. */
export function pickCandidateProfile<T extends CandidateIdentityFields>(rows: T[]): T {
  return [...rows].sort((a, b) => scoreCandidateProfile(b) - scoreCandidateProfile(a))[0] ?? rows[0];
}

/**
 * Find an existing worker by normalized phone + first/last name when email is missing
 * or did not match. Used to avoid creating duplicate candidate profiles.
 */
export async function findWorkerByPhoneAndName(
  supabase: SupabaseClient,
  options: {
    tenantId: string;
    phone: string | null | undefined;
    firstName: string;
    lastName?: string | null;
    excludeWorkerId?: string | null;
  }
): Promise<{ id: string; email: string | null } | null> {
  const tenantId = options.tenantId.trim().toLowerCase();
  const phoneDigits = normalizeCandidatePhone(options.phone);
  const nameKey = normalizeCandidatePersonName(options.firstName, options.lastName);
  if (!tenantId || phoneDigits.length < 10 || !nameKey) return null;

  const last10 = phoneDigits.slice(-10);
  const { data, error } = await supabase
    .from("worker")
    .select("id, email, phone, first_name, last_name")
    .eq("tenant_id", tenantId)
    .ilike("phone", `%${last10}%`)
    .limit(40);
  if (error) throw error;

  const exclude = options.excludeWorkerId?.trim() ?? "";
  for (const row of data ?? []) {
    const id = String((row as { id?: string }).id ?? "").trim();
    if (!id || (exclude && id === exclude)) continue;
    const rowPhone = normalizeCandidatePhone((row as { phone?: string | null }).phone);
    if (rowPhone.length < 10) continue;
    if (rowPhone.slice(-10) !== last10) continue;
    const rowName = normalizeCandidatePersonName(
      (row as { first_name?: string | null }).first_name,
      (row as { last_name?: string | null }).last_name
    );
    if (rowName !== nameKey) continue;
    return {
      id,
      email: (row as { email?: string | null }).email?.trim() || null,
    };
  }
  return null;
}

/**
 * Expand a set of worker IDs with other tenant workers that share email or phone+name.
 * Used so applied-job titles/counts can include applications attached to duplicate profiles.
 */
export async function findIdentitySiblingWorkerIds(
  supabase: SupabaseClient,
  tenantId: string | null,
  workers: CandidateIdentityFields[]
): Promise<string[]> {
  const seedIds = workers
    .map((row) => String(row.id ?? "").trim())
    .filter(Boolean);
  if (!tenantId || seedIds.length === 0) return seedIds;

  const emails = new Set<string>();
  const phoneNameKeys = new Set<string>();
  for (const row of workers) {
    const email = normalizeTenantEmail(String(row.email ?? ""));
    if (email) emails.add(email);
    const phone = normalizeCandidatePhone(row.phone);
    const name = normalizeCandidatePersonName(row.first_name, row.last_name);
    if (phone.length >= 10 && name) phoneNameKeys.add(`${phone.slice(-10)}:${name}`);
  }

  const siblingIds = new Set(seedIds);

  if (emails.size > 0) {
    const { data, error } = await queryInChunks([...emails], async (chunk) => {
      const result = await supabase
        .from("worker")
        .select("id, email")
        .eq("tenant_id", tenantId)
        .in("email", chunk);
      return {
        data: (result.data ?? []) as Array<{ id?: string; email?: string | null }>,
        error: result.error,
      };
    });
    if (error) throw error;
    for (const row of data) {
      const id = String(row.id ?? "").trim();
      if (id) siblingIds.add(id);
    }
  }

  if (phoneNameKeys.size > 0) {
    const phones = [
      ...new Set(
        [...phoneNameKeys].map((key) => key.split(":")[0]).filter((phone) => phone.length >= 10)
      ),
    ];
    for (const last10 of phones) {
      const { data, error } = await supabase
        .from("worker")
        .select("id, phone, first_name, last_name, email")
        .eq("tenant_id", tenantId)
        .ilike("phone", `%${last10}%`)
        .limit(40);
      if (error) throw error;
      for (const row of data ?? []) {
        const id = String((row as { id?: string }).id ?? "").trim();
        if (!id) continue;
        const phone = normalizeCandidatePhone((row as { phone?: string | null }).phone);
        const name = normalizeCandidatePersonName(
          (row as { first_name?: string | null }).first_name,
          (row as { last_name?: string | null }).last_name
        );
        if (phone.length < 10 || !name) continue;
        if (!phoneNameKeys.has(`${phone.slice(-10)}:${name}`)) continue;
        siblingIds.add(id);
      }
    }
  }

  return [...siblingIds];
}

/**
 * Collapse duplicate worker rows on a page into one candidate profile per identity.
 * Merges blank-email rows that share phone+name with an emailed profile, merges
 * applied job titles/counts, and prefers a row that already has an email.
 */
export function collapseWorkersToCandidateProfiles(
  workers: Record<string, unknown>[],
  options?: {
    jobTitlesByWorker?: Map<string, string[]>;
    appliedJobCounts?: Map<string, number>;
  }
): Record<string, unknown>[] {
  type RowMeta = {
    row: Record<string, unknown>;
    identity: CandidateIdentityFields;
    emailKey: string | null;
    phoneNameKey: string | null;
  };

  const metas: RowMeta[] = workers.map((row) => {
    const identity: CandidateIdentityFields = {
      id: typeof row.id === "string" ? row.id : null,
      email: typeof row.email === "string" ? row.email : null,
      phone: typeof row.phone === "string" ? row.phone : null,
      first_name: typeof row.first_name === "string" ? row.first_name : null,
      last_name: typeof row.last_name === "string" ? row.last_name : null,
      created_at: typeof row.created_at === "string" ? row.created_at : null,
      applied_job_count:
        typeof row.applied_job_count === "number" ? row.applied_job_count : null,
    };
    const email = normalizeTenantEmail(String(identity.email ?? ""));
    return {
      row,
      identity,
      emailKey: email ? `email:${email}` : null,
      phoneNameKey: candidatePhoneNameKey(identity),
    };
  });

  // Union-find over rows linked by shared email key or shared phone+name key.
  const parent = metas.map((_, index) => index);
  const find = (index: number): number => {
    let cursor = index;
    while (parent[cursor] !== cursor) {
      parent[cursor] = parent[parent[cursor]];
      cursor = parent[cursor];
    }
    return cursor;
  };
  const union = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };

  const byEmail = new Map<string, number>();
  const byPhoneName = new Map<string, number>();
  for (let i = 0; i < metas.length; i++) {
    const meta = metas[i];
    if (meta.emailKey) {
      const prev = byEmail.get(meta.emailKey);
      if (prev != null) union(prev, i);
      else byEmail.set(meta.emailKey, i);
    }
    if (meta.phoneNameKey) {
      const prev = byPhoneName.get(meta.phoneNameKey);
      if (prev != null) union(prev, i);
      else byPhoneName.set(meta.phoneNameKey, i);
    }
  }

  const groups = new Map<number, Record<string, unknown>[]>();
  const unkeyed: Record<string, unknown>[] = [];
  for (let i = 0; i < metas.length; i++) {
    const meta = metas[i];
    if (!meta.emailKey && !meta.phoneNameKey) {
      unkeyed.push(meta.row);
      continue;
    }
    const root = find(i);
    const list = groups.get(root) ?? [];
    list.push(meta.row);
    groups.set(root, list);
  }

  const collapsed: Record<string, unknown>[] = [];
  for (const group of groups.values()) {
    const profile = pickCandidateProfile(
      group.map((row) => ({
        ...row,
        id: typeof row.id === "string" ? row.id : "",
        email: typeof row.email === "string" ? row.email : null,
        phone: typeof row.phone === "string" ? row.phone : null,
        first_name: typeof row.first_name === "string" ? row.first_name : null,
        last_name: typeof row.last_name === "string" ? row.last_name : null,
        created_at: typeof row.created_at === "string" ? row.created_at : null,
        applied_job_count:
          typeof row.applied_job_count === "number" ? row.applied_job_count : null,
      }))
    );
    const profileId = String(profile.id ?? "").trim();
    const siblingIds = group
      .map((row) => (typeof row.id === "string" ? row.id.trim() : ""))
      .filter(Boolean);

    const titleSet = new Set<string>();
    let appCount = 0;
    let bestEmail = typeof profile.email === "string" ? profile.email.trim() : "";

    for (const id of siblingIds) {
      appCount += options?.appliedJobCounts?.get(id) ?? 0;
      for (const title of options?.jobTitlesByWorker?.get(id) ?? []) {
        if (title.trim()) titleSet.add(title.trim());
      }
      const sibling = group.find((row) => row.id === id);
      const siblingEmail =
        typeof sibling?.email === "string" ? sibling.email.trim() : "";
      if (!bestEmail && siblingEmail) bestEmail = siblingEmail;
      // Prefer any non-empty application_job_titles_text already rolled onto a sibling.
      const existingTitles =
        typeof sibling?.application_job_titles_text === "string"
          ? sibling.application_job_titles_text
          : "";
      for (const part of existingTitles.split(" | ")) {
        if (part.trim()) titleSet.add(part.trim());
      }
    }

    if (appCount <= 0) {
      appCount = typeof profile.applied_job_count === "number" ? profile.applied_job_count : 1;
    }

    collapsed.push({
      ...profile,
      ...(bestEmail ? { email: bestEmail } : {}),
      applied_job_count: appCount,
      ...(titleSet.size
        ? { application_job_titles_text: [...titleSet].join(" | ") }
        : {}),
      ...(siblingIds.length > 1
        ? { candidate_profile_sibling_ids: siblingIds.filter((id) => id !== profileId) }
        : {}),
    });
  }

  return [...collapsed, ...unkeyed];
}

/**
 * Collapse duplicate workers into unique candidate profiles while preserving
 * the first-seen order of each identity group (based on `orderedWorkers`).
 */
export function selectUniqueCandidateProfilesInOrder(
  orderedWorkers: Record<string, unknown>[]
): Record<string, unknown>[] {
  if (orderedWorkers.length <= 1) return [...orderedWorkers];

  type RowMeta = {
    index: number;
    row: Record<string, unknown>;
    emailKey: string | null;
    phoneNameKey: string | null;
  };

  const metas: RowMeta[] = orderedWorkers.map((row, index) => {
    const identity: CandidateIdentityFields = {
      id: typeof row.id === "string" ? row.id : null,
      email: typeof row.email === "string" ? row.email : null,
      phone: typeof row.phone === "string" ? row.phone : null,
      first_name: typeof row.first_name === "string" ? row.first_name : null,
      last_name: typeof row.last_name === "string" ? row.last_name : null,
      created_at: typeof row.created_at === "string" ? row.created_at : null,
      applied_job_count:
        typeof row.applied_job_count === "number" ? row.applied_job_count : null,
    };
    const email = normalizeTenantEmail(String(identity.email ?? ""));
    return {
      index,
      row,
      emailKey: email ? `email:${email}` : null,
      phoneNameKey: candidatePhoneNameKey(identity),
    };
  });

  const parent = metas.map((_, index) => index);
  const find = (index: number): number => {
    let cursor = index;
    while (parent[cursor] !== cursor) {
      parent[cursor] = parent[parent[cursor]];
      cursor = parent[cursor];
    }
    return cursor;
  };
  const union = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };

  const byEmail = new Map<string, number>();
  const byPhoneName = new Map<string, number>();
  for (let i = 0; i < metas.length; i++) {
    const meta = metas[i];
    if (meta.emailKey) {
      const prev = byEmail.get(meta.emailKey);
      if (prev != null) union(prev, i);
      else byEmail.set(meta.emailKey, i);
    }
    if (meta.phoneNameKey) {
      const prev = byPhoneName.get(meta.phoneNameKey);
      if (prev != null) union(prev, i);
      else byPhoneName.set(meta.phoneNameKey, i);
    }
  }

  const membersByRoot = new Map<number, number[]>();
  for (let i = 0; i < metas.length; i++) {
    const meta = metas[i];
    if (!meta.emailKey && !meta.phoneNameKey) {
      membersByRoot.set(~i, [i]); // unique sentinel for unkeyed rows
      continue;
    }
    const root = find(i);
    const list = membersByRoot.get(root) ?? [];
    list.push(i);
    membersByRoot.set(root, list);
  }

  const firstIndexByRoot = new Map<number, number>();
  for (const [root, members] of membersByRoot) {
    firstIndexByRoot.set(
      root,
      Math.min(...members.map((memberIndex) => metas[memberIndex].index))
    );
  }

  const orderedRoots = [...membersByRoot.keys()].sort(
    (a, b) => (firstIndexByRoot.get(a) ?? 0) - (firstIndexByRoot.get(b) ?? 0)
  );

  const result: Record<string, unknown>[] = [];
  for (const root of orderedRoots) {
    const members = membersByRoot.get(root) ?? [];
    const rows = members.map((memberIndex) => metas[memberIndex].row);
    if (rows.length === 1) {
      result.push(rows[0]);
      continue;
    }
    const profile = pickCandidateProfile(
      rows.map((row) => ({
        ...row,
        id: typeof row.id === "string" ? row.id : "",
        email: typeof row.email === "string" ? row.email : null,
        phone: typeof row.phone === "string" ? row.phone : null,
        first_name: typeof row.first_name === "string" ? row.first_name : null,
        last_name: typeof row.last_name === "string" ? row.last_name : null,
        created_at: typeof row.created_at === "string" ? row.created_at : null,
        applied_job_count:
          typeof row.applied_job_count === "number" ? row.applied_job_count : null,
      }))
    );
    let bestEmail = typeof profile.email === "string" ? profile.email.trim() : "";
    for (const row of rows) {
      const email = typeof row.email === "string" ? row.email.trim() : "";
      if (!bestEmail && email) bestEmail = email;
    }
    result.push({
      ...profile,
      ...(bestEmail ? { email: bestEmail } : {}),
    });
  }
  return result;
}

/** Count unique candidate profiles in a worker row set (email or phone+name identity). */
export function countUniqueCandidateProfiles(
  workers: Array<CandidateIdentityFields | Record<string, unknown>>
): number {
  return selectUniqueCandidateProfilesInOrder(
    workers.map((row) => row as Record<string, unknown>)
  ).length;
}
