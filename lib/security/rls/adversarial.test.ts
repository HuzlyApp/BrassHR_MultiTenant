import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CANARIES,
  CROSS_APPLICATION_CANARIES_FROM_A1,
  FOREIGN_TENANT_CANARIES,
  payloadContainsCanary,
} from "./canaries";
import { describeRlsSkipReason, isRlsLiveEnabled } from "./env";
import {
  anonClient,
  createRlsFixtures,
  destroyRlsFixtures,
  userClient,
  type RlsFixtures,
} from "./fixtures";

const live = isRlsLiveEnabled();

function leaked(payload: unknown, canaries: readonly string[] = FOREIGN_TENANT_CANARIES): string | null {
  return payloadContainsCanary(payload, canaries);
}

function rowCount(data: unknown): number {
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === "object") return 1;
  return 0;
}

describe.skipIf(!live)("RLS adversarial suite (live local/test only)", () => {
  let fx: RlsFixtures;
  let anon: SupabaseClient;
  let aAdmin: SupabaseClient;
  let aRecruiter: SupabaseClient;
  let aWorker: SupabaseClient;
  let bRecruiter: SupabaseClient;
  let noMember: SupabaseClient;

  beforeAll(async () => {
    fx = await createRlsFixtures();
    anon = anonClient();
    aAdmin = await userClient(fx.emails.tenant_a_admin, fx.password);
    aRecruiter = await userClient(fx.emails.tenant_a_recruiter, fx.password);
    aWorker = await userClient(fx.emails.tenant_a_worker, fx.password);
    bRecruiter = await userClient(fx.emails.tenant_b_recruiter, fx.password);
    noMember = await userClient(fx.emails.no_membership, fx.password);
  }, 120_000);

  afterAll(async () => {
    if (fx) await destroyRlsFixtures(fx);
  }, 60_000);

  describe("positive access", () => {
    it("Tenant A recruiter can read Tenant A application and A1 note", async () => {
      const { data: apps, error } = await aRecruiter
        .from("job_applications")
        .select("id, tenant_id")
        .eq("id", fx.tenantA.application1Id);
      expect(error).toBeNull();
      expect(rowCount(apps)).toBe(1);

      const { data: notes } = await aRecruiter
        .from("worker_notes")
        .select("id, body")
        .eq("id", fx.tenantA.note1Id);
      expect(rowCount(notes)).toBe(1);
      expect(payloadContainsCanary(notes, [CANARIES.noteA1])).toBe(CANARIES.noteA1);
    });

    it("Tenant B recruiter can still read Tenant B application after A attacks", async () => {
      const { data } = await bRecruiter
        .from("job_applications")
        .select("id")
        .eq("id", fx.tenantB.application1Id);
      expect(rowCount(data)).toBe(1);
    });
  });

  describe("anonymous", () => {
    it("cannot read private applications, notes, interviews, analysis, or workers", async () => {
      const tables = [
        "job_applications",
        "worker_notes",
        "interview_schedules",
        "job_application_analysis_versions",
        "job_application_decisions",
        "application_status_history",
        "application_screening_answers",
        "worker",
      ] as const;
      for (const table of tables) {
        const { data, error } = await anon.from(table).select("*").limit(20);
        expect(leaked(data), `${table} ${error?.message ?? ""}`).toBeNull();
        expect(rowCount(data)).toBe(0);
      }
    });

    it("cannot execute change_job_application_status", async () => {
      const { data, error } = await anon.rpc("change_job_application_status", {
        p_tenant_id: fx.tenantB.tenantId,
        p_application_id: fx.tenantB.application1Id,
        p_to_status_id: fx.tenantB.statusId,
        p_note: "ANON_STATUS_HIJACK",
      });
      expect(data).toBeNull();
      expect(error).toBeTruthy();
    });
  });

  describe("authenticated with no tenant membership", () => {
    it("cannot read Tenant A or B recruiting data", async () => {
      const { data } = await noMember
        .from("job_applications")
        .select("*")
        .eq("id", fx.tenantA.application1Id);
      expect(rowCount(data)).toBe(0);
      expect(leaked(data)).toBeNull();
    });
  });

  describe("cross-tenant SELECT (known UUIDs)", () => {
    it("Tenant A recruiter cannot read Tenant B application by primary key", async () => {
      const { data } = await aRecruiter
        .from("job_applications")
        .select("*")
        .eq("id", fx.tenantB.application1Id);
      expect(rowCount(data)).toBe(0);
      expect(leaked(data)).toBeNull();
    });

    it("Tenant A recruiter cannot read Tenant B by tenant_id, worker_id, or email filters", async () => {
      const queries = await Promise.all([
        aRecruiter.from("job_applications").select("*").eq("tenant_id", fx.tenantB.tenantId),
        aRecruiter.from("worker").select("*").eq("id", fx.tenantB.workerId),
        aRecruiter.from("worker").select("*").eq("email", fx.emails.tenant_b_worker),
        aRecruiter.from("worker_notes").select("*").eq("id", fx.tenantB.note1Id),
        aRecruiter.from("job_application_analysis_versions").select("*").eq("application_id", fx.tenantB.application1Id),
        aRecruiter.from("job_application_decisions").select("*").eq("application_id", fx.tenantB.application1Id),
        aRecruiter.from("interview_schedules").select("*").eq("application_id", fx.tenantB.application1Id),
        aRecruiter.from("application_statuses").select("*").eq("tenant_id", fx.tenantB.tenantId),
      ]);
      for (const result of queries) {
        expect(leaked(result.data)).toBeNull();
        expect(rowCount(result.data)).toBe(0);
      }
    });

    it("embedded joins do not leak Tenant B workers or notes", async () => {
      const { data } = await aRecruiter
        .from("job_applications")
        .select("*, worker(*), worker_notes(*)")
        .eq("id", fx.tenantA.application1Id);
      expect(rowCount(data)).toBe(1);
      expect(leaked(data)).toBeNull();
    });
  });

  describe("cross-tenant UPDATE / DELETE", () => {
    it("Tenant A recruiter cannot update Tenant B application or note", async () => {
      const { data: appUpdate, error: appErr } = await aRecruiter
        .from("job_applications")
        .update({ ai_match_status: "FAILED" })
        .eq("id", fx.tenantB.application1Id)
        .select("id");
      expect(rowCount(appUpdate)).toBe(0);

      const { data: noteUpdate } = await aRecruiter
        .from("worker_notes")
        .update({ body: "HACKED_BY_TENANT_A" })
        .eq("id", fx.tenantB.note1Id)
        .select("id");
      expect(rowCount(noteUpdate)).toBe(0);

      const { data: verify } = await bRecruiter
        .from("worker_notes")
        .select("body")
        .eq("id", fx.tenantB.note1Id);
      expect(payloadContainsCanary(verify, [CANARIES.noteB1])).toBe(CANARIES.noteB1);
      expect(appErr == null || rowCount(appUpdate) === 0).toBe(true);
    });

    it("Tenant A recruiter cannot delete Tenant B note; Tenant B still sees it", async () => {
      await aRecruiter.from("worker_notes").delete().eq("id", fx.tenantB.note1Id);
      const { data } = await bRecruiter.from("worker_notes").select("id").eq("id", fx.tenantB.note1Id);
      expect(rowCount(data)).toBe(1);
    });
  });

  describe("tenant id and FK spoofing on INSERT", () => {
    it("rejects insert of a note with Tenant B tenant_id", async () => {
      const { data, error } = await aRecruiter
        .from("worker_notes")
        .insert({
          tenant_id: fx.tenantB.tenantId,
          worker_id: fx.tenantB.workerId,
          application_id: fx.tenantB.application1Id,
          body: "SPOOF_TENANT_B_NOTE",
        })
        .select("id");
      expect(rowCount(data)).toBe(0);
      expect(error).toBeTruthy();
    });

    it("rejects insert attaching Tenant A tenant_id to Tenant B application_id", async () => {
      const { data, error } = await aRecruiter
        .from("worker_notes")
        .insert({
          tenant_id: fx.tenantA.tenantId,
          worker_id: fx.tenantA.workerId,
          application_id: fx.tenantB.application1Id,
          body: "SPOOF_FK_APPLICATION_B",
        })
        .select("id");
      expect(rowCount(data)).toBe(0);
      expect(error).toBeTruthy();
    });

    it("rejects upsert against Tenant B note primary key", async () => {
      const { data } = await aRecruiter.from("worker_notes").upsert({
        id: fx.tenantB.note1Id,
        tenant_id: fx.tenantA.tenantId,
        worker_id: fx.tenantA.workerId,
        application_id: fx.tenantA.application1Id,
        body: "UPSERT_OVER_B",
      }).select("id");
      expect(rowCount(data)).toBe(0);
      const { data: verify } = await bRecruiter
        .from("worker_notes")
        .select("body")
        .eq("id", fx.tenantB.note1Id);
      expect(payloadContainsCanary(verify, [CANARIES.noteB1])).toBe(CANARIES.noteB1);
    });
  });

  describe("application isolation", () => {
    it("A1 note query by application_id does not include A2 canary", async () => {
      const { data } = await aRecruiter
        .from("worker_notes")
        .select("body")
        .eq("application_id", fx.tenantA.application1Id);
      expect(payloadContainsCanary(data, [CANARIES.noteA1])).toBe(CANARIES.noteA1);
      expect(payloadContainsCanary(data, CROSS_APPLICATION_CANARIES_FROM_A1)).toBeNull();
    });

    it("A1 analysis history does not include A2 analysis", async () => {
      const { data } = await aRecruiter
        .from("job_application_analysis_versions")
        .select("analysis, application_id")
        .eq("application_id", fx.tenantA.application1Id);
      expect(payloadContainsCanary(data, [CANARIES.analysisA1])).toBe(CANARIES.analysisA1);
      expect(payloadContainsCanary(data, [CANARIES.analysisA2])).toBeNull();
    });
  });

  describe("role isolation", () => {
    it("recruiter cannot insert application status definitions", async () => {
      const { data, error } = await aRecruiter
        .from("application_statuses")
        .insert({
          tenant_id: fx.tenantA.tenantId,
          name: "Hacked Status",
          system_key: "hacked",
          is_active: true,
        })
        .select("id");
      expect(rowCount(data)).toBe(0);
      expect(error).toBeTruthy();
    });

    it("admin can insert a status in own tenant and cannot insert for Tenant B", async () => {
      const { data: own, error: ownErr } = await aAdmin
        .from("application_statuses")
        .insert({
          tenant_id: fx.tenantA.tenantId,
          name: `RLS Extra ${fx.runId}`,
          system_key: `rls_extra_${fx.runId}`.slice(0, 40),
          is_active: true,
        })
        .select("id");
      expect(ownErr).toBeNull();
      expect(rowCount(own)).toBe(1);

      const { data: foreign } = await aAdmin
        .from("application_statuses")
        .insert({
          tenant_id: fx.tenantB.tenantId,
          name: "Cross Tenant Status",
          system_key: "cross_tenant",
          is_active: true,
        })
        .select("id");
      expect(rowCount(foreign)).toBe(0);
    });

    it("worker cannot read recruiter notes or analysis for another candidate", async () => {
      const { data: notes } = await aWorker
        .from("worker_notes")
        .select("*")
        .eq("id", fx.tenantB.note1Id);
      expect(rowCount(notes)).toBe(0);

      const { data: apps } = await aWorker
        .from("job_applications")
        .select("*")
        .eq("id", fx.tenantB.application1Id);
      expect(rowCount(apps)).toBe(0);
    });

    it("worker cannot schedule interviews or assign recruiters", async () => {
      const { data: interview } = await aWorker.from("interview_schedules").insert({
        tenant_id: fx.tenantA.tenantId,
        application_id: fx.tenantA.application1Id,
        worker_id: fx.tenantA.workerId,
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 3600000).toISOString(),
      }).select("id");
      expect(rowCount(interview)).toBe(0);

      const { data: assign } = await aWorker
        .from("job_applications")
        .update({ assigned_recruiter_user_id: fx.tenantA.adminUserId })
        .eq("id", fx.tenantA.application1Id)
        .select("id");
      expect(rowCount(assign)).toBe(0);
    });
  });

  describe("privilege / metadata forgery", () => {
    it("user cannot become god_admin or change tenant_id via users update", async () => {
      const { data } = await aRecruiter
        .from("users")
        .update({ god_admin: true, tenant_id: fx.tenantB.tenantId, role: "admin" })
        .eq("id", fx.tenantA.recruiterUserId)
        .select("god_admin, tenant_id, role");
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        expect(row.god_admin).not.toBe(true);
        expect(row.tenant_id).not.toBe(fx.tenantB.tenantId);
      }
    });
  });

  describe("status history immutability", () => {
    it("recruiter cannot update or delete status history rows", async () => {
      const { data: history } = await aRecruiter
        .from("application_status_history")
        .select("id")
        .eq("application_id", fx.tenantA.application1Id)
        .limit(1);
      const id = Array.isArray(history) ? history[0]?.id : null;
      if (!id) return;
      const { data: updated } = await aRecruiter
        .from("application_status_history")
        .update({ note: "rewritten" })
        .eq("id", id)
        .select("id");
      expect(rowCount(updated)).toBe(0);
      const { data: deleted } = await aRecruiter
        .from("application_status_history")
        .delete()
        .eq("id", id)
        .select("id");
      expect(rowCount(deleted)).toBe(0);
    });
  });

  describe("counts", () => {
    it("Tenant A count of Tenant B applications is not an exact foreign total", async () => {
      const { count } = await aRecruiter
        .from("job_applications")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", fx.tenantB.tenantId);
      expect(count === null || count === 0).toBe(true);
    });
  });
});

describe("RLS adversarial suite gate", () => {
  it("documents how to enable live tests", () => {
    if (!live) {
      expect(describeRlsSkipReason().length).toBeGreaterThan(10);
    } else {
      expect(live).toBe(true);
    }
  });
});
