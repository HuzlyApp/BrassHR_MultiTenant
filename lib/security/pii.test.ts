import { describe, expect, it } from "vitest";
import { maskSensitiveIdentifier } from "./pii";
import { canAccessWorkerSensitiveData } from "@/lib/auth/worker-record-access";
describe("sensitive worker data",()=>{
 it.each(["recruiter","manager","finance","custom_role","worker"])("denies %s by default",role=>{expect(canAccessWorkerSensitiveData({role,godAdmin:false} as Parameters<typeof canAccessWorkerSensitiveData>[0])).toBe(false);});
 it.each(["admin","hr"])("allows verified %s after the route auth gate",role=>{expect(canAccessWorkerSensitiveData({role,godAdmin:false} as Parameters<typeof canAccessWorkerSensitiveData>[0])).toBe(true);});
 it("masks identifiers including short values",()=>{expect(maskSensitiveIdentifier("AB123456")).toBe("••••3456");expect(maskSensitiveIdentifier("1234")).toBe("••••");expect(maskSensitiveIdentifier(null)).toBeNull();});
});

it("renders the stored display suffix without decrypting a full identifier",()=>{
 expect(maskSensitiveIdentifier(null,"1234")).toBe("\u2022\u2022\u2022\u20221234");
});
