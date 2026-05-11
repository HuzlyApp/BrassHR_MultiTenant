import { createClient } from "@supabase/supabase-js";

const BASE_URL =
  process.env.LOCAL_TEST_BASE_URL?.trim() ||
  "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const BUCKET = "worker_required_files";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function pickWorker() {
  const { data, error } = await supabase
    .from("worker")
    .select("id,user_id,email,created_at")
    .not("user_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  if (!row?.id || !row?.user_id) {
    throw new Error("No worker with user_id found for upload verification");
  }
  return { workerId: String(row.id), applicantId: String(row.user_id), email: row.email ?? null };
}

async function uploadTestFile({ applicantId, folder, fileName, text }) {
  const fd = new FormData();
  fd.append("folder", folder);
  fd.append("applicantId", applicantId);
  fd.append("file", new File([text], fileName, { type: "application/pdf" }));

  const res = await fetch(`${BASE_URL}/api/onboarding/upload-required-file`, {
    method: "POST",
    body: fd,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Upload failed (${folder}/${fileName}): ${json?.error || res.status}`);
  }
  return json;
}

async function upsertWorkerDocuments(applicantId, payload) {
  const res = await fetch(`${BASE_URL}/api/onboarding/worker-documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ applicantId, ...payload }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`worker-documents POST failed: ${json?.error || res.status}`);
  }
  return json;
}

async function verifyStoragePath(path) {
  const parts = path.split("/");
  const fileName = parts.pop();
  const prefix = parts.join("/");
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 100 });
  if (error) return { exists: false, error: error.message };
  return { exists: Boolean(data?.some((f) => f.name === fileName)), error: null };
}

async function main() {
  const selected = await pickWorker();
  const runId = nowStamp();
  console.log("Verification worker:", selected);

  const nursing = await uploadTestFile({
    applicantId: selected.applicantId,
    folder: "license",
    fileName: `nursing-license-test-${runId}.pdf`,
    text: `Nursing License test upload ${runId}`,
  });
  const tb = await uploadTestFile({
    applicantId: selected.applicantId,
    folder: "tb",
    fileName: `tb-test-${runId}.pdf`,
    text: `TB Test upload ${runId}`,
  });
  const cpr = await uploadTestFile({
    applicantId: selected.applicantId,
    folder: "cpr",
    fileName: `cpr-cert-test-${runId}.pdf`,
    text: `CPR Certification upload ${runId}`,
  });
  const auth = await uploadTestFile({
    applicantId: selected.applicantId,
    folder: "license",
    fileName: `authorization-document-test-${runId}.pdf`,
    text: `Authorization document upload ${runId}`,
  });

  await upsertWorkerDocuments(selected.applicantId, {
    nursing_license_url: nursing.publicUrl,
    tb_test_url: tb.publicUrl,
    cpr_certification_url: cpr.publicUrl,
  });

  const { data: dbRow, error: dbErr } = await supabase
    .from("worker_documents")
    .select("*")
    .eq("worker_id", selected.workerId)
    .maybeSingle();
  if (dbErr) throw dbErr;

  const storageChecks = await Promise.all([
    verifyStoragePath(nursing.path),
    verifyStoragePath(tb.path),
    verifyStoragePath(cpr.path),
    verifyStoragePath(auth.path),
  ]);

  const report = [
    {
      documentType: "Nursing License",
      uploadRoute: "/api/onboarding/upload-required-file",
      bucket: BUCKET,
      storagePath: nursing.path,
      storageSaved: storageChecks[0].exists,
      dbTable: "worker_documents",
      dbUrlColumn: "nursing_license_url",
      linkedIdColumn: "worker_id",
      linkedIdValue: selected.workerId,
      dbUrlSaved: dbRow?.nursing_license_url ?? null,
    },
    {
      documentType: "TB Test",
      uploadRoute: "/api/onboarding/upload-required-file",
      bucket: BUCKET,
      storagePath: tb.path,
      storageSaved: storageChecks[1].exists,
      dbTable: "worker_documents",
      dbUrlColumn: "tb_test_url",
      linkedIdColumn: "worker_id",
      linkedIdValue: selected.workerId,
      dbUrlSaved: dbRow?.tb_test_url ?? null,
    },
    {
      documentType: "CPR Certifications",
      uploadRoute: "/api/onboarding/upload-required-file",
      bucket: BUCKET,
      storagePath: cpr.path,
      storageSaved: storageChecks[2].exists,
      dbTable: "worker_documents",
      dbUrlColumn: "cpr_certification_url",
      linkedIdColumn: "worker_id",
      linkedIdValue: selected.workerId,
      dbUrlSaved: dbRow?.cpr_certification_url ?? null,
    },
    {
      documentType: "Authorization Document",
      uploadRoute: "/api/onboarding/upload-required-file (storage fallback)",
      bucket: BUCKET,
      storagePath: auth.path,
      storageSaved: storageChecks[3].exists,
      dbTable: "worker_documents or zoho_sign_requests",
      dbUrlColumn: "document_url (optional)",
      linkedIdColumn: "worker_id / applicant_id",
      linkedIdValue: selected.workerId,
      dbUrlSaved: dbRow?.document_url ?? null,
    },
  ];

  console.table(report);
  console.log("worker_documents row id:", dbRow?.id ?? null);
  console.log("Done.");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
