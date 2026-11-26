import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const state = vi.hoisted(()=>({counts:new Map<string,number>(),password:vi.fn()}));
vi.mock("@/lib/security/rate-limit",()=>({
 getClientIp:(req:Request)=>req.headers.get("x-test-ip") || "test-ip",
 enforceRateLimit:async (_req:Request,options:{namespace:string;key:string;limit:number})=>{
  const key=options.namespace+":"+options.key;
  const count=(state.counts.get(key)||0)+1;state.counts.set(key,count);
  return count>options.limit?NextResponse.json({error:"Too many requests"},{status:429}):null;
 },
}));
vi.mock("@/lib/supabase/ephemeral-auth-client",()=>({createEphemeralAuthClient:()=>({auth:{signInWithPassword:state.password}})}));
import { POST } from "./route";
function request(email:string,ip:string){return new NextRequest("https://qa.test/api/auth/login-otp/send",{method:"POST",headers:{"content-type":"application/json","x-test-ip":ip},body:JSON.stringify({email,password:"invalid",purpose:"staff"})});}
beforeEach(()=>{state.counts.clear();state.password.mockReset().mockResolvedValue({data:{user:null},error:{message:"Invalid login credentials"}});});
describe("independent auth abuse buckets",()=>{
 it("keeps the email budget when an attacker rotates source IPs",async()=>{
  for(let i=0;i<10;i++)expect((await POST(request("staff@example.test","ip-"+i))).status).toBe(401);
  expect((await POST(request("staff@example.test","ip-11"))).status).toBe(429);
  expect(state.password).toHaveBeenCalledTimes(10);
 });
 it("keeps the IP budget when an attacker rotates email addresses",async()=>{
  for(let i=0;i<30;i++)expect((await POST(request("staff"+i+"@example.test","one-ip"))).status).toBe(401);
  expect((await POST(request("different@example.test","one-ip"))).status).toBe(429);
  expect(state.password).toHaveBeenCalledTimes(30);
 });
});
