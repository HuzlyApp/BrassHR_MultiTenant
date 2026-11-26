import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createNotification,
  createNotificationsForUsers,
  listTenantStaffUserIds,
} from "@/lib/notifications/create-notification";
import { withTenant } from "@/lib/tenant/with-tenant";

async function portalMessageLink(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  groupId?: string,
) {
  const [tenant, membership] = await Promise.all([
    supabase.from("tenants").select("slug").eq("id", tenantId).maybeSingle(),
    supabase
      .from("user_roles")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (tenant.error) throw tenant.error;
  if (membership.error) throw membership.error;
  const path =
    membership.data?.role === "candidate"
      ? "/application/candidate/messages"
      : "/application/applicant-dashboard/group-chat?" +
        (groupId
          ? "tab=group&group=" + encodeURIComponent(groupId)
          : "tab=recruiter");
  return withTenant(path, tenant.data?.slug);
}

/** Notification failures must not turn a saved message into a failed send/retry. */
export async function notifyDirectMessage(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    workerId: string;
    senderUserId: string | null;
    senderRole: "applicant" | "recruiter";
    body: string;
    attachmentName?: string | null;
  },
): Promise<void> {
  try {
    const body =
      params.body.trim() || "Attachment: " + (params.attachmentName || "File");
    if (params.senderRole === "applicant") {
      const staffIds = await listTenantStaffUserIds(
        supabase,
        params.tenantId,
        params.senderUserId ? [params.senderUserId] : [],
      );
      await createNotificationsForUsers(supabase, {
        tenantId: params.tenantId,
        userIds: staffIds,
        type: "direct_message",
        title: "New applicant message",
        body,
        link:
          "/admin_recruiter/messages?workerId=" +
          encodeURIComponent(params.workerId),
      });
      return;
    }
    const worker = await supabase
      .from("worker")
      .select("user_id")
      .eq("tenant_id", params.tenantId)
      .eq("id", params.workerId)
      .maybeSingle();
    if (worker.error) throw worker.error;
    const userId = worker.data?.user_id;
    if (!userId || userId === params.senderUserId) return;
    await createNotification(supabase, {
      tenantId: params.tenantId,
      userId,
      type: "direct_message",
      title: "New message from your recruiter",
      body,
      link: await portalMessageLink(supabase, params.tenantId, userId),
    });
  } catch (error) {
    console.error("[messaging:notify-direct]", error);
  }
}

export async function notifyGroupMessage(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    groupId: string;
    groupName: string;
    senderUserId: string | null;
    senderWorkerId?: string;
    body: string;
  },
): Promise<void> {
  try {
    // group_members.user_id stores worker IDs, not authentication user IDs.
    const members = await supabase
      .from("group_members")
      .select("user_id")
      .eq("tenant_id", params.tenantId)
      .eq("group_id", params.groupId);
    if (members.error) throw members.error;
    const workerIds = (members.data ?? [])
      .map((row) => String(row.user_id))
      .filter((id) => id !== params.senderWorkerId);
    if (workerIds.length) {
      const workers = await supabase
        .from("worker")
        .select("user_id")
        .eq("tenant_id", params.tenantId)
        .in("id", workerIds);
      if (workers.error) throw workers.error;
      const userIds = new Set<string>(
        (workers.data ?? []).map((row) => row.user_id).filter(Boolean),
      );
      userIds.delete(params.senderUserId ?? "");
      for (const userId of userIds) {
        await createNotification(supabase, {
          tenantId: params.tenantId,
          userId,
          type: "group_message",
          title: "New message in " + params.groupName,
          body: params.body,
          link: await portalMessageLink(
            supabase,
            params.tenantId,
            userId,
            params.groupId,
          ),
        });
      }
    }
    const staffIds = await listTenantStaffUserIds(
      supabase,
      params.tenantId,
      params.senderUserId ? [params.senderUserId] : [],
    );
    await createNotificationsForUsers(supabase, {
      tenantId: params.tenantId,
      userIds: staffIds,
      type: "group_message",
      title: "New message in " + params.groupName,
      body: params.body,
      link:
        "/admin_recruiter/messages?tab=group&group=" +
        encodeURIComponent(params.groupId),
    });
  } catch (error) {
    console.error("[messaging:notify-group]", error);
  }
}
