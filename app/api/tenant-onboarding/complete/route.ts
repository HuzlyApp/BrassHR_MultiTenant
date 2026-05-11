import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

function slugify(name: string, explicit?: string | null): string {
  const base = explicit?.trim() || "";
  const s = (base.length > 1 ? base : name.trim().toLowerCase())
    .replace(/[^a-z0-9\s-]/gi, " ")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80)
    .toLowerCase()
    .replace(/^-+|-+$/g, "") || `org-${Date.now()}`;
  return s;
}

type Body = {
  organizationName?: string;
  slug?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  welcomeHeadline?: string | null;
  welcomeSubtitle?: string | null;
  authBackgroundImageUrl?: string | null;
  adminEmail?: string;
  adminPassword?: string;
};

/**
 * Registers a tenant + creates the initial admin recruiter (requires service role server-side).
 */
export async function POST(req: Request) {
  const svc = createServiceRoleClient();
  if (!svc) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const org = String(body.organizationName ?? "").trim();
  const adminEmail = String(body.adminEmail ?? "").trim().toLowerCase();
  const adminPassword = String(body.adminPassword ?? "");
  const slugFinal = slugify(org, body.slug ?? null);

  if (org.length < 2 || !adminEmail.includes("@")) {
    return NextResponse.json({ error: "Organization name and a valid admin email are required." }, { status: 400 });
  }
  if (adminPassword.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const { data: existingSlug, error: existingSlugErr } = await svc.from("tenants").select("id").eq("slug", slugFinal).maybeSingle();
  if (existingSlugErr) {
    return NextResponse.json({ error: existingSlugErr.message }, { status: 500 });
  }

  let tenantId: string;
  if (existingSlug?.id) {
    const { data: existingAdminRoles, error: rolesErr } = await svc
      .from("user_roles")
      .select("user_id")
      .eq("tenant_id", existingSlug.id)
      .eq("role", "admin")
      .limit(1);
    if (rolesErr) {
      return NextResponse.json({ error: rolesErr.message }, { status: 500 });
    }

    if ((existingAdminRoles?.length ?? 0) > 0) {
      return NextResponse.json(
        {
          error: "That slug is already in use.",
          slug: slugFinal,
        },
        { status: 409 }
      );
    }

    tenantId = String(existingSlug.id);
  } else {
    const { data: tenant, error: tErr } = await svc
      .from("tenants")
      .insert({
        name: org,
        slug: slugFinal,
        plan: "starter",
        is_active: true,
        logo_url: body.logoUrl?.trim() || null,
        primary_color: body.primaryColor?.trim() || "#0d9488",
        secondary_color: body.secondaryColor?.trim() || "#0f766e",
        accent_color: body.accentColor?.trim() || "#99f6e4",
        welcome_headline: body.welcomeHeadline?.trim() || `Welcome to ${org}`,
        welcome_subtitle: body.welcomeSubtitle?.trim() || "Your applicant experience starts here.",
        auth_background_image_url: body.authBackgroundImageUrl?.trim() || null,
      })
      .select(
        "id, name, slug, logo_url, primary_color, secondary_color, accent_color, welcome_headline, welcome_subtitle, auth_background_image_url"
      )
      .single();

    if (tErr || !tenant?.id) {
      console.error("[tenant-onboarding]", tErr?.message ?? tErr);
      return NextResponse.json({ error: tErr?.message || "Could not save tenant." }, { status: 500 });
    }

    tenantId = String((tenant as { id: string }).id);
  }

  const { data: list, error: listErr } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  const found = list?.users?.find((u) => (u.email || "").toLowerCase() === adminEmail);
  let userId: string | undefined = found?.id;

  const appMd = {
    platform: "nexus",
    tenant_id: tenantId,
    role: "admin",
  };

  if (!userId) {
    const { data: created, error: cuErr } = await svc.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      app_metadata: appMd,
    });
    if (cuErr || !created.user?.id) {
      console.error("[tenant-onboarding] createUser", cuErr?.message);
      await svc.from("tenants").delete().eq("id", tenantId);
      return NextResponse.json({ error: cuErr?.message || "Could not create admin user." }, { status: 500 });
    }
    userId = created.user.id;
  } else {
    const { error: updErr } = await svc.auth.admin.updateUserById(userId, {
      password: adminPassword,
      email_confirm: true,
      app_metadata: appMd,
    });
    if (updErr) {
      console.error("[tenant-onboarding] updateUser", updErr.message);
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
  }

  const { error: uErr } = await svc.from("users").upsert(
    {
      id: userId,
      tenant_id: tenantId,
      email: adminEmail,
      role: "admin",
      email_verified: true,
    },
    { onConflict: "id" }
  );
  if (uErr) {
    console.error("[tenant-onboarding] users", uErr.message);
    return NextResponse.json({ error: "Could not link admin profile.", detail: uErr.message }, { status: 500 });
  }

  const { error: rErr } = await svc
    .from("user_roles")
    .upsert({ user_id: userId, tenant_id: tenantId, role: "admin" }, { onConflict: "user_id,tenant_id" });
  if (rErr) {
    console.error("[tenant-onboarding] user_roles", rErr.message);
    return NextResponse.json({ error: "Could not save admin role.", detail: rErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    tenantId,
    slug: slugFinal,
  });
}
