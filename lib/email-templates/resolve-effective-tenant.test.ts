import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
const state = vi.hoisted(() => ({ slug: "", selected: "22222222-2222-4222-8222-222222222222" }));
vi.mock("next/headers", () => ({ cookies: async () => ({get: () => state.slug ? {value:state.slug} : undefined}) }));
vi.mock("@/lib/godadmin/view-as-tenant", () => ({readValidatedViewAsTenantId: async () => null}));
vi.mock("@/lib/tenant/resolve-tenant-id-by-slug", () => ({resolveTenantIdBySlug: async () => state.selected}));
import { resolveEffectiveAdminTenantId } from "./resolve-effective-tenant";
const tenantA="11111111-1111-4111-8111-111111111111";
describe("current tenant authorization", () => {
  beforeEach(()=>{state.slug="";});
  const run = (membership: unknown, profile: unknown = {tenant_id:tenantA,role:"admin",is_active:true}) => {
    const sb={from:(table:string)=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:table==="users"?profile:membership,error:null})};return q;}};
    return resolveEffectiveAdminTenantId(sb as never,{userId:"staff",authUser:{id:"staff",app_metadata:{tenant_id:state.selected,role:"admin"}} as User,godAdmin:false});
  };
  it("uses the current profile rather than stale JWT tenant claims",async()=>{expect(await run(null)).toBe(tenantA);});
  it("does not restore a disabled membership through the profile role",async()=>{expect(await run({role:"admin",is_active:false})).toBeNull();});
  it("rejects another selected tenant without membership",async()=>{state.slug="other";expect(await run(null)).toBeNull();});
  it("accepts active membership in the selected tenant",async()=>{state.slug="other";expect(await run({role:"recruiter",is_active:true})).toBe(state.selected);});
  it("rejects disabled profiles even with active membership",async()=>{expect(await run({role:"admin",is_active:true},{tenant_id:tenantA,role:"admin",is_active:false})).toBeNull();});
});
