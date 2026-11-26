import { describe, expect, it, vi } from "vitest";
import { uploadApplicantPortalFile, validatePortalUploadFile } from "./upload";
describe("portal upload boundary",()=>{
 it("rejects a renamed executable before storage sees it",async()=>{
  const from=vi.fn();const file=new File([new Uint8Array([0x4d,0x5a,0,0])],"document.pdf",{type:"application/pdf"});
  await expect(uploadApplicantPortalFile({storage:{from}} as never,file,"worker-a","identity")).rejects.toThrow(/contents/);
  expect(from).not.toHaveBeenCalled();
 });
 it("requires a real extension and a nonempty file",()=>{
  expect(validatePortalUploadFile(new File(["%PDF-1.7"],"document.exe",{type:"application/pdf"}))).toMatch(/type/);
  expect(validatePortalUploadFile(new File([],"empty.pdf",{type:"application/pdf"}))).toMatch(/empty/);
 });
});
