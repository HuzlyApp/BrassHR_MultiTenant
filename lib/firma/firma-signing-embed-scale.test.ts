import { describe, expect, it } from "vitest";
import {
  computeFirmaEmbedScale,
  FIRMA_EMBED_MOBILE_MAX_SCALE,
  FIRMA_MIN_CSS_WIDTH_FOR_ROW_ACTIONS,
  FIRMA_NATIVE_EMBED_MAX_WIDTH,
  resolveFirmaEmbedDimensions,
  resolveFirmaEmbedUiBoost,
} from "./firma-signing-embed-scale";

describe("resolveFirmaEmbedUiBoost", () => {
  it("uses a stronger boost on narrower viewports", () => {
    expect(resolveFirmaEmbedUiBoost(360)).toBe(1.75);
    expect(resolveFirmaEmbedUiBoost(512)).toBe(1.65);
    expect(resolveFirmaEmbedUiBoost(898)).toBe(1.4);
    expect(resolveFirmaEmbedUiBoost(1280)).toBe(1.3);
  });
});

describe("FIRMA_NATIVE_EMBED_MAX_WIDTH", () => {
  it("covers typical phone widths for native full-screen signing", () => {
    expect(FIRMA_NATIVE_EMBED_MAX_WIDTH).toBe(639);
    expect(477).toBeLessThanOrEqual(FIRMA_NATIVE_EMBED_MAX_WIDTH);
  });
});

describe("resolveFirmaEmbedDimensions", () => {
  it("matches container aspect ratio so the embed can fill tall screens", () => {
    const { width, height } = resolveFirmaEmbedDimensions(800, 800, 1000);
    expect(width).toBeGreaterThan(0);
    expect(height / width).toBeCloseTo(1000 / 800, 1);
  });

  it("falls back to a square canvas when container size is unknown", () => {
    const { width, height } = resolveFirmaEmbedDimensions(1280);
    expect(width).toBe(height);
  });

  it("keeps Confirm/Cancel row width on tablet scaled embeds only", () => {
    const phone = resolveFirmaEmbedDimensions(375);
    const tablet = resolveFirmaEmbedDimensions(768);
    expect(phone.width).toBeLessThan(FIRMA_MIN_CSS_WIDTH_FOR_ROW_ACTIONS);
    expect(tablet.width).toBeGreaterThanOrEqual(FIRMA_MIN_CSS_WIDTH_FOR_ROW_ACTIONS);
  });
});

describe("computeFirmaEmbedScale", () => {
  it("fills both width and height when embed aspect matches the container", () => {
    const availableWidth = 800;
    const availableHeight = 1000;
    const { width, height } = resolveFirmaEmbedDimensions(800, availableWidth, availableHeight);
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

  it("allows slight tablet upscale for chrome visibility", () => {
    const scale = computeFirmaEmbedScale(400, 700, 380, 665, {
      maxScale: FIRMA_EMBED_MOBILE_MAX_SCALE,
    });
    expect(scale).toBeGreaterThan(1);
    expect(scale).toBeLessThanOrEqual(FIRMA_EMBED_MOBILE_MAX_SCALE);
  });
});
