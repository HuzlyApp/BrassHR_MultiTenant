import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";
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
  try {
    const url = getSupabaseUrl();
    const key = getSupabaseAnonKey();
    if (!url || !key) {
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    }

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { searchParams } = new URL(req.url);
    const stateCode = searchParams.get("stateCode")?.trim().toUpperCase() ?? "";

    if (stateCode) {
      const { data: cities, error: citiesErr } = await supabase
        .from("signup_us_cities")
        .select("city_name, state_code, sort_order")
        .eq("state_code", stateCode)
        .order("sort_order", { ascending: true })
        .order("city_name", { ascending: true });

      if (citiesErr) {
        console.error("[signup/options] cities query failed", citiesErr);
        return NextResponse.json({ error: "Could not load cities" }, { status: 500 });
      }

      const cityOptions: SignupCityOption[] = (cities ?? []).map((row) => ({
        name: String(row.city_name),
        stateCode: String(row.state_code),
      }));

      return NextResponse.json({ cities: cityOptions });
    }

    const { data: states, error: statesErr } = await supabase
      .from("signup_us_states")
      .select("code, name, sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (statesErr) {
      console.error("[signup/options] states query failed", statesErr);
      return NextResponse.json({ error: "Could not load states" }, { status: 500 });
    }

    const stateOptions: SignupStateOption[] = (states ?? []).map((row) => ({
      code: String(row.code),
      name: String(row.name),
    }));

    return NextResponse.json({ states: stateOptions });
  } catch (error) {
    console.error("[signup/options] unexpected error", error);
    return NextResponse.json({ error: "Could not load signup options" }, { status: 500 });
  }
}
