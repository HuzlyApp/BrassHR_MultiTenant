import { describe, expect, it } from "vitest";
import { validateDocumentUploadBytes } from "@/lib/document-upload-helpers";
describe("document content validation",()=>{
 it("rejects an executable renamed PDF even with an allowed browser MIME",()=>{expect(validateDocumentUploadBytes("proof.pdf",new Uint8Array([0x4d,0x5a,0,0]))).toMatch(/contents/);});
 it("rejects unknown extensions and empty uploads",()=>{expect(validateDocumentUploadBytes("proof.exe",new Uint8Array([0x25,0x50,0x44,0x46,0x2d]))).not.toBeNull();expect(validateDocumentUploadBytes("proof.pdf",new Uint8Array())).not.toBeNull();});
 it("accepts matching PDF and PNG signatures",()=>{expect(validateDocumentUploadBytes("proof.pdf",new TextEncoder().encode("%PDF-1.7"))).toBeNull();expect(validateDocumentUploadBytes("proof.png",new Uint8Array([137,80,78,71,13,10,26,10]))).toBeNull();});
});
