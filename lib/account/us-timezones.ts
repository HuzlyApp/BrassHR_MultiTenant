export type UsTimezoneOption = {
  value: string;
  label: string;
  region: string;
};

/** All IANA time zones used in US states and territories. */
export const US_TIMEZONE_OPTIONS: UsTimezoneOption[] = [
  { value: "America/New_York", label: "New York", region: "Eastern" },
  { value: "America/Detroit", label: "Detroit, MI", region: "Eastern" },
  { value: "America/Kentucky/Louisville", label: "Louisville, KY", region: "Eastern" },
  { value: "America/Kentucky/Monticello", label: "Monticello, KY", region: "Eastern" },
  { value: "America/Indiana/Indianapolis", label: "Indianapolis, IN", region: "Eastern" },
  { value: "America/Indiana/Vincennes", label: "Vincennes, IN", region: "Eastern" },
  { value: "America/Indiana/Winamac", label: "Winamac, IN", region: "Eastern" },
  { value: "America/Indiana/Marengo", label: "Marengo, IN", region: "Eastern" },
  { value: "America/Indiana/Petersburg", label: "Petersburg, IN", region: "Eastern" },
  { value: "America/Indiana/Vevay", label: "Vevay, IN", region: "Eastern" },
  { value: "America/Chicago", label: "Chicago, IL", region: "Central" },
  { value: "America/Indiana/Tell_City", label: "Tell City, IN", region: "Central" },
  { value: "America/Indiana/Knox", label: "Knox, IN", region: "Central" },
  { value: "America/Menominee", label: "Menominee, MI", region: "Central" },
  { value: "America/North_Dakota/Center", label: "Center, ND", region: "Central" },
  { value: "America/North_Dakota/New_Salem", label: "New Salem, ND", region: "Central" },
  { value: "America/North_Dakota/Beulah", label: "Beulah, ND", region: "Central" },
  { value: "America/Denver", label: "Denver, CO", region: "Mountain" },
  { value: "America/Boise", label: "Boise, ID", region: "Mountain" },
  { value: "America/Phoenix", label: "Phoenix, AZ (no DST)", region: "Mountain" },
  { value: "America/Los_Angeles", label: "Los Angeles, CA", region: "Pacific" },
  { value: "America/Anchorage", label: "Anchorage, AK", region: "Alaska" },
  { value: "America/Juneau", label: "Juneau, AK", region: "Alaska" },
  { value: "America/Sitka", label: "Sitka, AK", region: "Alaska" },
  { value: "America/Metlakatla", label: "Metlakatla, AK", region: "Alaska" },
  { value: "America/Yakutat", label: "Yakutat, AK", region: "Alaska" },
  { value: "America/Nome", label: "Nome, AK", region: "Alaska" },
  { value: "America/Adak", label: "Adak, AK (Aleutian)", region: "Alaska" },
  { value: "Pacific/Honolulu", label: "Honolulu, HI", region: "Hawaii" },
  { value: "America/Puerto_Rico", label: "Puerto Rico", region: "US Territories" },
  { value: "America/St_Thomas", label: "US Virgin Islands", region: "US Territories" },
  { value: "Pacific/Guam", label: "Guam", region: "US Territories" },
  { value: "Pacific/Saipan", label: "Northern Mariana Islands", region: "US Territories" },
  { value: "Pacific/Pago_Pago", label: "American Samoa", region: "US Territories" },
];

export const US_TIMEZONE_REGIONS = [
  "Eastern",
  "Central",
  "Mountain",
  "Pacific",
  "Alaska",
  "Hawaii",
  "US Territories",
] as const;

const US_TIMEZONE_VALUES = new Set(US_TIMEZONE_OPTIONS.map((option) => option.value));

export function isUsTimezone(value: string): boolean {
  return US_TIMEZONE_VALUES.has(value);
}

/** Include saved value when it is outside the US list (e.g. legacy UTC). */
export function buildTimezoneSelectOptions(savedTimezone?: string | null): UsTimezoneOption[] {
  const saved = savedTimezone?.trim();
  if (!saved || isUsTimezone(saved)) return US_TIMEZONE_OPTIONS;
  return [
    { value: saved, label: saved, region: "Other" },
    ...US_TIMEZONE_OPTIONS,
  ];
}

export function timezoneRegionsForOptions(
  options: UsTimezoneOption[]
): Array<(typeof US_TIMEZONE_REGIONS)[number] | "Other"> {
  const regions = new Set(options.map((option) => option.region));
  const ordered: Array<(typeof US_TIMEZONE_REGIONS)[number] | "Other"> = [];
  if (regions.has("Other")) ordered.push("Other");
  for (const region of US_TIMEZONE_REGIONS) {
    if (regions.has(region)) ordered.push(region);
  }
  return ordered;
}
