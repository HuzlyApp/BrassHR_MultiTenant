import { describe, expect, it } from "vitest";
import {
  computeFirmaEmbedScale,
  resolveFirmaEmbedDimensions,
  resolveFirmaEmbedUiBoost,
} from "./firma-signing-embed-scale";

describe("resolveFirmaEmbedUiBoost", () => {
  it("uses a stronger boost on narrow phones", () => {
    expect(resolveFirmaEmbedUiBoost(360)).toBe(1.65);
    expect(resolveFirmaEmbedUiBoost(512)).toBe(1.55);
    expect(resolveFirmaEmbedUiBoost(898)).toBe(1.4);
    expect(resolveFirmaEmbedUiBoost(1280)).toBe(1.3);
  });
});

describe("computeFirmaEmbedScale", () => {
  it("limits scale by width on narrow viewports", () => {
    const { width, height } = resolveFirmaEmbedDimensions(512);
    const scale = computeFirmaEmbedScale(512, 820, width, height);

    expect(scale).toBeLessThan(1);
    expect(Math.round(width * scale)).toBeLessThanOrEqual(512);
    expect(Math.round(height * scale)).toBeLessThanOrEqual(820);
  });

  it("never drops below the minimum scale floor", () => {
    const { width, height } = resolveFirmaEmbedDimensions(320);
    const scale = computeFirmaEmbedScale(280, 360, width, height);

    expect(scale).toBeGreaterThanOrEqual(0.38);
  });
});
