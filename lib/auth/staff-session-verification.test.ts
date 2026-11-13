import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStaffSessionProof } from "./login-otp-proof";
const state=vi.hoisted(()=>({token:"",proof:"",valid:true,mfa:false}));
vi.mock("next/headers",()=>({headers:async()=>new Headers(),cookies:async()=>({get:()=>({value:state.proof})})}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({auth:{
  getSession:async()=>({data:{session:{access_token:state.token}}}),
  getUser:async()=>({data:{user:{id:"staff",is_anonymous:false,factors:state.mfa?[{status:"verified"}]:[]}},error:state.valid?null:new Error("invalid")}),
}})}));
import { hasVerifiedStaffSession } from "./staff-session-verification";
const token=(session_id="session-a",aal="aal1")=>`header.${Buffer.from(JSON.stringify({sub:"staff",session_id,aal})).toString("base64url")}.signature`;
const user={id:"staff"} as Parameters<typeof hasVerifiedStaffSession>[0];
describe("staff session verification",()=>{
  beforeEach(()=>{process.env.LOGIN_OTP_PROOF_SECRET="test-secret";state.token=token();state.proof=createStaffSessionProof("staff","session-a");state.valid=true;state.mfa=false;});
  it("accepts the authenticated session after OTP",async()=>{expect(await hasVerifiedStaffSession(user)).toBe(true);});
  it("rejects password-only sessions",async()=>{state.proof="";expect(await hasVerifiedStaffSession(user)).toBe(false);});
  it("does not trust an unverified JWT",async()=>{state.valid=false;expect(await hasVerifiedStaffSession(user)).toBe(false);});
  it("rejects proof copied from another session",async()=>{state.token=token("session-b");expect(await hasVerifiedStaffSession(user)).toBe(false);});
  it("requires aal2 for accounts with enrolled MFA",async()=>{state.mfa=true;expect(await hasVerifiedStaffSession(user)).toBe(false);state.token=token("session-a","aal2");expect(await hasVerifiedStaffSession(user)).toBe(true);});
});
