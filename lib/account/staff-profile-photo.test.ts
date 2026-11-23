import { describe, expect, it } from "vitest";
import { sanitizeStaffProfileFileName, validateStaffProfilePhoto } from "./staff-profile-photo";

const photo = (type: string, size = 100) => ({ type, size }) as File;

describe("staff profile photos", () => {
  it("accepts JPG and PNG up to the displayed 2 MB limit", () => {
    expect(validateStaffProfilePhoto(photo("image/jpeg", 2 * 1024 * 1024))).toBeNull();
    expect(validateStaffProfilePhoto(photo("image/png"))).toBeNull();
  });
  it("rejects oversized photos before upload", () => {
    expect(validateStaffProfilePhoto(photo("image/jpeg", 2 * 1024 * 1024 + 1))).toContain("max 2 MB");
  });
  it.each(["image/webp", "image/svg+xml", "text/plain", ""])("rejects unsupported type %s", (type) => {
    expect(validateStaffProfilePhoto(photo(type))).toBe("Please upload a JPG or PNG photo.");
  });
  it("keeps storage keys safe for URL signing", () => {
    const name = sanitizeStaffProfileFileName("QA-TEST logo #1 & Co™.png");
    expect(name).toMatch(/^[a-zA-Z0-9._-]+$/);
    expect(new URL(`https://example.com/${name}`).hash).toBe("");
    expect(name.endsWith(".png")).toBe(true);
  });
});
