const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function isValidBrandingHex(value: string): boolean {
  return HEX_RE.test(value.trim());
}
