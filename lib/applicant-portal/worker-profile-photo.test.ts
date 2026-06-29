import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/applicant-portal/upload", () => ({
  createSignedPortalFileUrl: vi.fn(async () => "https://signed.example/photo.jpg"),
}));

import { attachWorkerProfilePhotoUrls } from "@/lib/applicant-portal/worker-profile-photo";
import { createSignedPortalFileUrl } from "@/lib/applicant-portal/upload";

describe("attachWorkerProfilePhotoUrls", () => {
  it("signs each row when invoked (opt-in via includePhotoUrls on API)", async () => {
    const supabase = {} as never;
    const rows = [
      { id: "w1", profile_photo: "path/a.jpg" },
      { id: "w2", profile_photo: "path/b.jpg" },
    ];
    const result = await attachWorkerProfilePhotoUrls(supabase, rows);
    expect(result).toHaveLength(2);
    expect(createSignedPortalFileUrl).toHaveBeenCalledTimes(2);
    expect(result[0].profile_photo_url).toContain("https://");
  });
});
