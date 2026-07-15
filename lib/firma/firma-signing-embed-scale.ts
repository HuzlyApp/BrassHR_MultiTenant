/** Firma signing UI is laid out for a ~1080px desktop viewport. */
export const FIRMA_SIGNING_DESKTOP_WIDTH = 1080;
export const FIRMA_SIGNING_DESKTOP_HEIGHT = 1080;

/** Smaller virtual canvas → controls read larger once scaled into phone/tablet viewports. */
export function resolveFirmaEmbedUiBoost(viewportWidth: number): number {
  if (viewportWidth < 400) return 1.65;
  if (viewportWidth < 640) return 1.55;
  if (viewportWidth < 1024) return 1.4;
  return 1.3;
}

/**
 * Virtual iframe canvas size.
 * When container size is known, match its aspect ratio so the scaled UI fills
 * the signing modal instead of leaving large empty bands (especially on mobile).
 */
export function resolveFirmaEmbedDimensions(
  viewportWidth: number,
  availableWidth?: number,
  availableHeight?: number
): {
  width: number;
  height: number;
} {
  const boost = resolveFirmaEmbedUiBoost(viewportWidth);
  const width = Math.round(FIRMA_SIGNING_DESKTOP_WIDTH / boost);

  if (
    typeof availableWidth === "number" &&
    typeof availableHeight === "number" &&
    availableWidth > 0 &&
    availableHeight > 0
  ) {
    const aspect = availableWidth / availableHeight;
    return {
      width,
      height: Math.max(Math.round(width / aspect), Math.round(width * 0.75)),
    };
  }

  return {
    width,
    height: Math.round(FIRMA_SIGNING_DESKTOP_HEIGHT / boost),
  };
}

export const FIRMA_EMBED_MIN_SCALE = 0.38;
export const FIRMA_EMBED_MAX_SCALE = 1;

export function computeFirmaEmbedScale(
  availableWidth: number,
  availableHeight: number,
  embedWidth: number,
  embedHeight: number
): number {
  if (availableWidth <= 0 || availableHeight <= 0 || embedWidth <= 0 || embedHeight <= 0) {
    return FIRMA_EMBED_MAX_SCALE;
  }

  const widthScale = availableWidth / embedWidth;
  const heightScale = availableHeight / embedHeight;
  const fitScale = Math.min(widthScale, heightScale, FIRMA_EMBED_MAX_SCALE);

  return Math.max(FIRMA_EMBED_MIN_SCALE, fitScale);
}
