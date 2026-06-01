import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { SignupCityOption, SignupStateOption } from "@/lib/signup/owner-signup";

/**
 * Signup dropdowns from Supabase reference tables:
 * - public.signup_us_states (all US states)
 * - public.signup_us_cities (cities per state_code)
 *
 * GET /api/auth/signup/options → all states
 * GET /api/auth/signup/options?stateCode=CA → cities for California
 */
export async function GET(req: Request) {
  const svc = createServiceRoleClient();
  if (!svc) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const stateCode = searchParams.get("stateCode")?.trim().toUpperCase() ?? "";

  const { data: states, error: statesErr } = await svc
    .from("signup_us_states")
    .select("code, name, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (statesErr) {
    return NextResponse.json({ error: statesErr.message }, { status: 500 });
  }

  let citiesQuery = svc
    .from("signup_us_cities")
    .select("city_name, state_code, sort_order")
    .order("sort_order", { ascending: true })
    .order("city_name", { ascending: true });

  if (stateCode) {
    citiesQuery = citiesQuery.eq("state_code", stateCode);
  }

  const { data: cities, error: citiesErr } = await citiesQuery;

  if (citiesErr) {
    return NextResponse.json({ error: citiesErr.message }, { status: 500 });
  }

  const stateOptions: SignupStateOption[] = (states ?? []).map((row) => ({
    code: String(row.code),
    name: String(row.name),
  }));

  const cityOptions: SignupCityOption[] = (cities ?? []).map((row) => ({
    name: String(row.city_name),
    stateCode: String(row.state_code),
  }));

  return NextResponse.json({ states: stateOptions, cities: cityOptions });
}
