/**
 * USPS 3-digit ZIP prefix ranges by state/territory code.
 * Used to verify a ZIP belongs to the selected state (heuristic, not city-level).
 */
export const US_ZIP_PREFIX_RANGES: Record<string, Array<[number, number]>> = {
  AL: [[350, 369]],
  AK: [[995, 999]],
  AZ: [[850, 865]],
  AR: [[716, 729]],
  CA: [[900, 961]],
  CO: [[800, 816]],
  CT: [[60, 69]],
  DE: [[197, 199]],
  DC: [[200, 205]],
  FL: [[320, 349]],
  GA: [[300, 319], [398, 399]],
  HI: [[967, 968]],
  ID: [[832, 838]],
  IL: [[600, 629]],
  IN: [[460, 479]],
  IA: [[500, 528]],
  KS: [[660, 679]],
  KY: [[400, 427]],
  LA: [[700, 714]],
  MA: [[10, 27], [55, 55]],
  MD: [[206, 219]],
  ME: [[39, 49]],
  MI: [[480, 499]],
  MN: [[550, 567]],
  MO: [[630, 658]],
  MS: [[386, 397]],
  MT: [[590, 599]],
  NC: [[270, 289]],
  ND: [[580, 588]],
  NE: [[680, 693]],
  NH: [[30, 38]],
  NJ: [[70, 89]],
  NM: [[870, 884]],
  NV: [[889, 898]],
  NY: [[100, 149]],
  OH: [[430, 458]],
  OK: [[730, 749]],
  OR: [[970, 979]],
  PA: [[150, 196]],
  RI: [[28, 29]],
  SC: [[290, 299]],
  SD: [[570, 577]],
  TN: [[370, 385]],
  TX: [[750, 799], [885, 885]],
  UT: [[840, 847]],
  VA: [[201, 201], [220, 246]],
  VT: [[50, 54], [56, 59]],
  WA: [[980, 994]],
  WI: [[530, 549]],
  WV: [[247, 268]],
  WY: [[820, 831]],
};

export function zipPrefixBelongsToState(zip5: string, stateCode: string): boolean {
  const digits = zip5.replace(/\D/g, "");
  if (digits.length < 5) return false;
  const prefix = Number.parseInt(digits.slice(0, 3), 10);
  if (!Number.isFinite(prefix)) return false;

  const ranges = US_ZIP_PREFIX_RANGES[stateCode.toUpperCase()];
  if (!ranges?.length) return false;

  return ranges.some(([min, max]) => prefix >= min && prefix <= max);
}
