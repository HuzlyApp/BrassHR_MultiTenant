import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";
import { getServiceRoleKey } from "./env";
import { CANARIES } from "./canaries";

export type IdentityName =
  | "anon"
  | "no_membership"
  | "tenant_a_admin"
  | "tenant_a_recruiter"
  | "tenant_a_worker"
  | "tenant_b_admin"
  | "tenant_b_recruiter"
  | "tenant_b_worker";

export type TenantBundle = {
  tenantId: string;
  adminUserId: string;
  recruiterUserId: string;
  workerUserId: string;
  workerId: string;
  job1Id: string;
  job2Id: string;
  application1Id: string;
  application2Id: string;
  note1Id: string;
  note2Id: string;
  statusId: string;
};

export type RlsFixtures = {
  runId: string;
  password: string;
  emails: Record<Exclude<IdentityName, "anon">, string>;
  tenantA: TenantBundle;
  tenantB: TenantBundle;
  authUsers: Array<{ id: string; email: string }>;
};

function adminClient(): SupabaseClient {
  const url = getSupabaseUrl();
  const key = getServiceRoleKey();
  if (!url || !key) throw new Error("Service role client is not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function anonClient(): SupabaseClient {
  const url = getSupabaseUrl();
  const anon = getSupabaseAnonKey();
  if (!url || !anon) throw new Error("Anon client is not configured");
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function userClient(email: string, password: string): Promise<SupabaseClient> {
  const url = getSupabaseUrl();
  const anon = getSupabaseAnonKey();
  if (!url || !anon) throw new Error("Anon client is not configured");
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function insertOne<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  row: T
): Promise<string> {
  const { data, error } = await supabase.from(table).insert(row).select("id").single();
  if (error || !data?.id) {
    throw new Error(`${table} insert failed: ${error?.message ?? "no id"}`);
  }
  return String(data.id);
}

async function createAuthUser(
  supabase: SupabaseClient,
  email: string,
  password: string
): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user?.id) {
    throw new Error(`createUser(${email}) failed: ${error?.message ?? "no id"}`);
  }
  return data.user.id;
}

async function ensurePublicUser(
  supabase: SupabaseClient,
  id: string,
  tenantId: string | null,
  role: "admin" | "client" | "worker",
  email: string
) {
  const { error } = await supabase.from("users").upsert(
    {
      id,
      tenant_id: tenantId,
      email,
      first_name: email.split("@")[0],
      last_name: "RLS",
      role,
      god_admin: false,
      is_active: true,
      is_verified: true,
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(`users upsert failed: ${error.message}`);
}

async function ensureRole(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string,
  role: "admin" | "client" | "worker"
) {
  const { error } = await supabase.from("user_roles").insert({
    user_id: userId,
    tenant_id: tenantId,
    role,
  });
  if (error && !/duplicate|unique/i.test(error.message)) {
    throw new Error(`user_roles insert failed: ${error.message}`);
  }
}

async function createTenantStack(
  supabase: SupabaseClient,
  args: {
    runId: string;
    label: "a" | "b";
    name: string;
    canary: string;
    app1Canary: string;
    app2Canary: string;
    note1: string;
    note2: string;
    screening1: string;
    analysis1: string;
    analysis2: string;
    adminId: string;
    recruiterId: string;
    workerAuthId: string;
  }
): Promise<TenantBundle> {
  const slug = `rls-canary-${args.label}-${args.runId}`.slice(0, 60);
  const tenantId = await insertOne(supabase, "tenants", {
    name: args.name,
    slug,
    subdomain: slug,
    is_active: true,
    plan: "trial",
  });

  await ensurePublicUser(supabase, args.adminId, tenantId, "admin", "");
  await ensurePublicUser(supabase, args.recruiterId, tenantId, "client", "");
  await ensurePublicUser(supabase, args.workerAuthId, tenantId, "worker", "");
  await ensureRole(supabase, args.adminId, tenantId, "admin");
  await ensureRole(supabase, args.recruiterId, tenantId, "client");

  const { error: adminEmailErr } = await supabase
    .from("users")
    .update({ email: `admin-${args.label}-${args.runId}@rls.test` })
    .eq("id", args.adminId);
  if (adminEmailErr) throw adminEmailErr;

  const professionId = await insertOne(supabase, "professions", {
    tenant_id: tenantId,
    code: `RLS_${args.label}_${args.runId}`.slice(0, 20),
    name: "RLS Profession",
    is_active: true,
  });

  const flowId = await insertOne(supabase, "onboarding_flows", {
    tenant_id: tenantId,
    name: `RLS Flow ${args.label}`,
    status: "published",
  });

  const jobBase = {
    tenant_id: tenantId,
    profession_id: professionId,
    employment_type: "W2",
    placement_type: "Internal",
    source_type: "Internal",
    workflow_id: flowId,
    status: "published",
    public_title: `${args.canary} Job`,
    public_description: `${args.canary} description`,
    location: "Test City, TX",
    published_at: new Date().toISOString(),
  };

  const job1Id = await insertOne(supabase, "job_requisitions", {
    ...jobBase,
    public_title: `${args.app1Canary} Job 1`,
  });
  const job2Id = await insertOne(supabase, "job_requisitions", {
    ...jobBase,
    public_title: `${args.app2Canary} Job 2`,
  });

  const workerId = await insertOne(supabase, "worker", {
    tenant_id: tenantId,
    user_id: args.workerAuthId,
    first_name: `Worker${args.label.toUpperCase()}`,
    last_name: "Canary",
    email: `worker-${args.label}-${args.runId}@rls.test`,
    status: "applicant",
  });

  const profileId = await insertOne(supabase, "applicant_profiles", {
    tenant_id: tenantId,
    auth_user_id: args.workerAuthId,
    worker_id: workerId,
    email: `worker-${args.label}-${args.runId}@rls.test`,
    first_name: `Worker${args.label.toUpperCase()}`,
    last_name: "Canary",
  });

  const application1Id = await insertOne(supabase, "job_applications", {
    tenant_id: tenantId,
    job_requisition_id: job1Id,
    workflow_id: flowId,
    worker_id: workerId,
    applicant_profile_id: profileId,
    applicant_auth_user_id: args.workerAuthId,
    status: "new",
    source: "applicant",
    ai_analysis: { summary: args.analysis1 },
  });
  const application2Id = await insertOne(supabase, "job_applications", {
    tenant_id: tenantId,
    job_requisition_id: job2Id,
    workflow_id: flowId,
    worker_id: workerId,
    applicant_profile_id: profileId,
    applicant_auth_user_id: args.workerAuthId,
    status: "new",
    source: "applicant",
    ai_analysis: { summary: args.analysis2 },
  });

  const { data: statuses, error: statusErr } = await supabase
    .from("application_statuses")
    .select("id")
    .eq("tenant_id", tenantId)
    .limit(1);
  if (statusErr) throw statusErr;
  let statusId = statuses?.[0]?.id ? String(statuses[0].id) : "";
  if (!statusId) {
    statusId = await insertOne(supabase, "application_statuses", {
      tenant_id: tenantId,
      name: "New",
      system_key: "new",
      is_active: true,
      sort_order: 1,
    });
  }

  const note1Id = await insertOne(supabase, "worker_notes", {
    tenant_id: tenantId,
    worker_id: workerId,
    application_id: application1Id,
    created_by_user_id: args.recruiterId,
    body: args.note1,
  });
  const note2Id = await insertOne(supabase, "worker_notes", {
    tenant_id: tenantId,
    worker_id: workerId,
    application_id: application2Id,
    created_by_user_id: args.recruiterId,
    body: args.note2,
  });

  await supabase.from("job_application_analysis_versions").insert({
    tenant_id: tenantId,
    application_id: application1Id,
    version: 1,
    analysis: { summary: args.analysis1 },
    score: 88,
  });
  await supabase.from("job_application_analysis_versions").insert({
    tenant_id: tenantId,
    application_id: application2Id,
    version: 1,
    analysis: { summary: args.analysis2 },
    score: 42,
  });

  await supabase.from("job_application_decisions").insert({
    tenant_id: tenantId,
    application_id: application1Id,
    decision: "proceed_to_screening",
    note: args.label === "a" ? CANARIES.decisionA1 : CANARIES.decisionB1,
    recorded_by: args.recruiterId,
  });

  const { error: interviewErr } = await supabase.from("interview_schedules").insert({
    tenant_id: tenantId,
    application_id: application1Id,
    worker_id: workerId,
    applicant_id: workerId,
    job_id: job1Id,
    title: "RLS Interview",
    scheduled_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    start_time: new Date(Date.now() + 86400000).toISOString(),
    end_time: new Date(Date.now() + 90000000).toISOString(),
    meeting_type: "online",
    status: "upcoming",
    meeting_link: args.label === "a" ? CANARIES.interviewA1 : CANARIES.interviewB1,
    calendar_uid: `brass-rls-${application1Id}@brasshr.com`,
    created_by: args.recruiterId,
  });
  if (interviewErr && !/foreign key|applicant_id/i.test(interviewErr.message)) {
    throw new Error(`interview_schedules insert failed: ${interviewErr.message}`);
  }

  return {
    tenantId,
    adminUserId: args.adminId,
    recruiterUserId: args.recruiterId,
    workerUserId: args.workerAuthId,
    workerId,
    job1Id,
    job2Id,
    application1Id,
    application2Id,
    note1Id,
    note2Id,
    statusId,
  };
}

export async function createRlsFixtures(): Promise<RlsFixtures> {
  const supabase = adminClient();
  const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const password = `Rls!${runId}Aa1`;
  const emails = {
    no_membership: `nomem-${runId}@rls.test`,
    tenant_a_admin: `admin-a-${runId}@rls.test`,
    tenant_a_recruiter: `recruiter-a-${runId}@rls.test`,
    tenant_a_worker: `worker-a-${runId}@rls.test`,
    tenant_b_admin: `admin-b-${runId}@rls.test`,
    tenant_b_recruiter: `recruiter-b-${runId}@rls.test`,
    tenant_b_worker: `worker-b-${runId}@rls.test`,
  } as const;

  const ids = {
    no_membership: await createAuthUser(supabase, emails.no_membership, password),
    tenant_a_admin: await createAuthUser(supabase, emails.tenant_a_admin, password),
    tenant_a_recruiter: await createAuthUser(supabase, emails.tenant_a_recruiter, password),
    tenant_a_worker: await createAuthUser(supabase, emails.tenant_a_worker, password),
    tenant_b_admin: await createAuthUser(supabase, emails.tenant_b_admin, password),
    tenant_b_recruiter: await createAuthUser(supabase, emails.tenant_b_recruiter, password),
    tenant_b_worker: await createAuthUser(supabase, emails.tenant_b_worker, password),
  };

  await ensurePublicUser(supabase, ids.no_membership, null, "worker", emails.no_membership);

  const tenantA = await createTenantStack(supabase, {
    runId,
    label: "a",
    name: `RLS Tenant A ${CANARIES.tenantA}`,
    canary: CANARIES.tenantA,
    app1Canary: CANARIES.applicationA1,
    app2Canary: CANARIES.applicationA2,
    note1: CANARIES.noteA1,
    note2: CANARIES.noteA2,
    screening1: CANARIES.screeningA1,
    analysis1: CANARIES.analysisA1,
    analysis2: CANARIES.analysisA2,
    adminId: ids.tenant_a_admin,
    recruiterId: ids.tenant_a_recruiter,
    workerAuthId: ids.tenant_a_worker,
  });

  const tenantB = await createTenantStack(supabase, {
    runId,
    label: "b",
    name: `RLS Tenant B ${CANARIES.tenantB}`,
    canary: CANARIES.tenantB,
    app1Canary: CANARIES.applicationB1,
    app2Canary: CANARIES.applicationB2,
    note1: CANARIES.noteB1,
    note2: `${CANARIES.applicationB2} note`,
    screening1: CANARIES.screeningB1,
    analysis1: CANARIES.analysisB1,
    analysis2: `${CANARIES.applicationB2} analysis`,
    adminId: ids.tenant_b_admin,
    recruiterId: ids.tenant_b_recruiter,
    workerAuthId: ids.tenant_b_worker,
  });

  await supabase.from("users").update({ email: emails.tenant_a_admin }).eq("id", ids.tenant_a_admin);
  await supabase.from("users").update({ email: emails.tenant_a_recruiter }).eq("id", ids.tenant_a_recruiter);
  await supabase.from("users").update({ email: emails.tenant_a_worker }).eq("id", ids.tenant_a_worker);
  await supabase.from("users").update({ email: emails.tenant_b_admin }).eq("id", ids.tenant_b_admin);
  await supabase.from("users").update({ email: emails.tenant_b_recruiter }).eq("id", ids.tenant_b_recruiter);
  await supabase.from("users").update({ email: emails.tenant_b_worker }).eq("id", ids.tenant_b_worker);

  return {
    runId,
    password,
    emails: { ...emails },
    tenantA,
    tenantB,
    authUsers: Object.entries(ids).map(([key, id]) => ({
      id,
      email: emails[key as keyof typeof emails],
    })),
  };
}

export async function destroyRlsFixtures(fx: RlsFixtures): Promise<void> {
  const supabase = adminClient();
  await supabase.from("tenants").delete().eq("id", fx.tenantA.tenantId);
  await supabase.from("tenants").delete().eq("id", fx.tenantB.tenantId);
  await supabase.from("users").delete().eq("id", fx.authUsers.find((u) => u.email === fx.emails.no_membership)?.id);
  for (const user of fx.authUsers) {
    await supabase.auth.admin.deleteUser(user.id);
  }
}
