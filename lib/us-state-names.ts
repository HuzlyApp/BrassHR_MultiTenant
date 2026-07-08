/** US state/territory display name → two-letter code (matches signup_us_states). */
export const US_STATE_NAME_TO_CODE: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  "District of Columbia": "DC",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
};

export function getStateCodeFromName(stateName: string): string | undefined {
  const trimmed = stateName.trim();
  if (!trimmed) return undefined;
  return US_STATE_NAME_TO_CODE[trimmed];
}

/** Two-letter code → display name (reverse of US_STATE_NAME_TO_CODE). */
export const US_STATE_CODE_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATE_NAME_TO_CODE).map(([name, code]) => [code, name])
);

export function getStateNameFromCode(stateCode: string): string | undefined {
  const trimmed = stateCode.trim().toUpperCase();
  if (!trimmed) return undefined;
  return US_STATE_CODE_TO_NAME[trimmed];
}
