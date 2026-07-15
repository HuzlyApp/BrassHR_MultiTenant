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

describe("resolveFirmaEmbedDimensions", () => {
  it("matches container aspect ratio so the embed can fill tall phone screens", () => {
    const { width, height } = resolveFirmaEmbedDimensions(483, 483, 857);
    expect(width).toBeGreaterThan(0);
    expect(height / width).toBeCloseTo(857 / 483, 1);
  });

  it("falls back to a square canvas when container size is unknown", () => {
    const { width, height } = resolveFirmaEmbedDimensions(1280);
    expect(width).toBe(height);
  });
});

describe("computeFirmaEmbedScale", () => {
  it("fills both width and height when embed aspect matches the container", () => {
    const availableWidth = 512;
    const availableHeight = 820;
    const { width, height } = resolveFirmaEmbedDimensions(512, availableWidth, availableHeight);
    const scale = computeFirmaEmbedScale(availableWidth, availableHeight, width, height);

    expect(Math.round(width * scale)).toBeLessThanOrEqual(availableWidth);
    expect(Math.round(height * scale)).toBeLessThanOrEqual(availableHeight);
    expect(Math.round(width * scale)).toBeGreaterThanOrEqual(availableWidth - 2);
    expect(Math.round(height * scale)).toBeGreaterThanOrEqual(availableHeight - 2);
  });

  it("never drops below the minimum scale floor", () => {
    const { width, height } = resolveFirmaEmbedDimensions(320);
    const scale = computeFirmaEmbedScale(280, 360, width, height);

    expect(scale).toBeGreaterThanOrEqual(0.38);
  });
});
