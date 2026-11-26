import { describe, expect, it, vi } from "vitest";
import { parseStoredStorageReference, resolveStorageAccessibleUrl, privateDocumentUrlTtl } from "@/lib/supabase/resolve-storage-accessible-url";

describe("parseStoredStorageReference", () => {
  it("parses legacy public object URLs", () => {
    const ref = parseStoredStorageReference(
      "https://example.supabase.co/storage/v1/object/public/worker_required_files/tenant/worker/file.pdf"
    );
    expect(ref).toEqual({
      kind: "storage",
      bucket: "worker_required_files",
      path: "tenant/worker/file.pdf",
    });
  });

  it("treats bare paths as worker_required_files objects", () => {
    const ref = parseStoredStorageReference("tenant-id/worker-id/admin/ssn_url/file.pdf");
    expect(ref).toEqual({
      kind: "storage",
      bucket: "worker_required_files",
      path: "tenant-id/worker-id/admin/ssn_url/file.pdf",
    });
  });

  it("passes through external app URLs", () => {
    const ref = parseStoredStorageReference("/api/external/document?request_id=abc");
    expect(ref).toEqual({
      kind: "external",
      url: "/api/external/document?request_id=abc",
    });
  });
});

describe("private document access", () => {
  it("bounds bearer lifetime even for legacy one-hour callers", () => {
    expect(privateDocumentUrlTtl()).toBe(120);
    expect(privateDocumentUrlTtl(3600)).toBe(300);
    expect(privateDocumentUrlTtl(0)).toBe(60);
    expect(privateDocumentUrlTtl(NaN)).toBe(120);
  });
  it("re-signs stored bearer URLs instead of extending their original token", () => {
    expect(parseStoredStorageReference("https://example.supabase.co/storage/v1/object/sign/docs/t/w/file.pdf?token=old")).toEqual({kind:"storage",bucket:"docs",path:"t/w/file.pdf"});
  });
  it("never falls back to a private bucket's legacy public URL when authorization/signing fails", async () => {
    const sign = vi.fn().mockResolvedValue({data:null,error:{message:"denied"}});
    const client = {storage:{from:()=>({createSignedUrl:sign})}} as unknown as Parameters<typeof resolveStorageAccessibleUrl>[0];
    expect(await resolveStorageAccessibleUrl(client,"https://example.supabase.co/storage/v1/object/public/docs/t/w/file.pdf",{expiresIn:3600})).toBeNull();
    expect(sign).toHaveBeenCalledWith("t/w/file.pdf",300);
  });
});
