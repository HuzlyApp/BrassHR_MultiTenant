import { describe, expect, it } from "vitest";
import { parseStoredStorageReference } from "@/lib/supabase/resolve-storage-accessible-url";

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

  it("passes through app proxy URLs", () => {
    const ref = parseStoredStorageReference("/api/zoho-sign/document?request_id=abc");
    expect(ref).toEqual({
      kind: "external",
      url: "/api/zoho-sign/document?request_id=abc",
    });
  });
});
