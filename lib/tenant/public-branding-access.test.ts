import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("@supabase/supabase-js",()=>({createClient:()=>({rpc:mocks.rpc})}));
vi.mock("@/lib/supabase-env",()=>({getSupabaseUrl:()=>"https://test.supabase.co",getSupabaseAnonKey:()=>"public-test-key"}));
import { loadPublicTenantBranding } from "./load-public-tenant-branding";
import { resolveTenantIdBySlugUncached } from "./resolve-tenant-id-by-slug";
describe("public branding boundary",()=>{
 beforeEach(()=>mocks.rpc.mockReset());
 it("loads the exact slug through the bounded RPC, without table enumeration",async()=>{
  mocks.rpc.mockResolvedValue({data:{id:"tenant-a",slug:"a",name:"Company A"},error:null});
  expect((await loadPublicTenantBranding({slug:"a"})).companyName).toBe("Company A");
  expect(mocks.rpc).toHaveBeenCalledWith("public_tenant_branding",{p_kind:"slug",p_value:"a"});
 });
 it("does not fall back to a different company for a missing explicit slug",async()=>{
  mocks.rpc.mockResolvedValue({data:null,error:null});
  expect((await loadPublicTenantBranding({slug:"missing-company"})).id).toBeNull();
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
 });
 it("passes lookup text as an RPC parameter rather than a PostgREST filter",async()=>{
  mocks.rpc.mockResolvedValue({data:null,error:null});
  const client={rpc:mocks.rpc} as unknown as Parameters<typeof resolveTenantIdBySlugUncached>[0];
  expect(await resolveTenantIdBySlugUncached(client,"a,slug.neq.b")).toBeNull();
  expect(mocks.rpc).toHaveBeenCalledWith("public_tenant_branding",{p_kind:"slug",p_value:"a,slug.neq.b"});
 });
});
