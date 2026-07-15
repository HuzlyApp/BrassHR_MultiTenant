import { describe, expect, it } from "vitest";
import {
  logoDisplayZoom,
  BRANDING_RIGHT_PANEL_LOGO_DIVIDER_GAP_REM,
} from "@/app/components/BrandingRightPanelLogo";

describe("logoDisplayZoom", () => {
  it("restores live ZipStaff-sized zoom for large square logos", () => {
    expect(logoDisplayZoom(1024, 1024)).toBe(1.7);
  });

  it("does not enlarge landscape wordmarks", () => {
    expect(logoDisplayZoom(600, 400)).toBe(1);
  });
});

describe("right panel logo-star gap", () => {
  it("keeps the tighter logo-to-star gap", () => {
    expect(BRANDING_RIGHT_PANEL_LOGO_DIVIDER_GAP_REM).toBe(1.875);
  });
});
