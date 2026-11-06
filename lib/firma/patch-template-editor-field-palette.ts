/**
 * Firma's embedded template editor hardcodes its Field Types list.
 * Workspace custom fields do not appear there. These entries are spliced
 * into the editor bundle so they drag on like Name / Job Title and save as
 * text fields with format_rules.prefilledData.
 *
 * `prefilledData` matches recipient attributes or custom_fields keys we send.
 */
export const BRASSHR_TEMPLATE_EDITOR_SIGNING_FIELDS = [
  { id: "first_name", label: "First Name", placeholder: "First name" },
  { id: "last_name", label: "Last Name", placeholder: "Last name" },
  { id: "street_address", label: "Street Address", placeholder: "Street address" },
  { id: "address_line_2", label: "Address Line 2", placeholder: "Address line 2" },
  { id: "city", label: "City", placeholder: "City" },
  { id: "state_province", label: "State / Province", placeholder: "State or province" },
  { id: "postal_code", label: "ZIP / Postal Code", placeholder: "ZIP or postal code" },
  { id: "country", label: "Country", placeholder: "Country" },
  { id: "candidate_address", label: "Full Address", placeholder: "Full address" },
  { id: "date_of_birth", label: "Date of Birth", placeholder: "Date of birth" },
  { id: "ssn_last_four", label: "SSN (Last 4)", placeholder: "Last 4 of SSN" },
  { id: "employment_type", label: "Employment Type", placeholder: "Employment type" },
  { id: "start_date", label: "Start / Hire Date", placeholder: "Start or hire date" },
  { id: "pay_rate", label: "Pay Rate", placeholder: "Pay rate" },
  { id: "pay_frequency", label: "Pay Frequency", placeholder: "Pay frequency" },
  { id: "manager_name", label: "Manager Name", placeholder: "Manager name" },
] as const;

const ALLOWED_TYPES_ANCHOR =
  'gne=["name","email","phone","company","title","text","date","number","checkbox","dropdown","radio","textarea","url","file"]';

const PALETTE_ANCHOR =
  '{id:"title",nameKey:"templateEditor.titleField",icon:w.jsx(et,{icon:"fa-solid fa-briefcase",size:16}),descriptionKey:"templateEditor.titleFieldDesc",designation:"shared"},{id:"separator-2"';

const PRESET_ANCHOR =
  'company:{label:"Company Name",placeholder:"Enter company name",prefilledData:"company"},signing_date:';

const COERCE_ANCHOR = '["name","phone","email","title","company"].includes(S.type)?C.type="text"';

const PREFILLED_DROPDOWN_ANCHOR =
  '{value:"country",label:"Country"},{value:"title",label:"Title"}';

/** Built-in Firma dropdown already lists these prefilledData values. */
const BUILTIN_PREFILLED_VALUES = new Set([
  "email",
  "first_name",
  "last_name",
  "full_name",
  "phone_number",
  "street_address",
  "city",
  "state_province",
  "postal_code",
  "country",
  "title",
  "company",
]);

function jsString(value: string): string {
  return JSON.stringify(value);
}

function paletteEntriesSource(): string {
  return BRASSHR_TEMPLATE_EDITOR_SIGNING_FIELDS.map(
    (field) =>
      `{id:${jsString(field.id)},nameKey:${jsString(field.label)},icon:w.jsx(et,{icon:"fa-solid fa-user",size:16}),descriptionKey:"Filled when the document is sent",designation:"shared"}`
  ).join(",");
}

function presetEntriesSource(): string {
  return BRASSHR_TEMPLATE_EDITOR_SIGNING_FIELDS.map(
    (field) =>
      `${field.id}:{label:${jsString(field.label)},placeholder:${jsString(field.placeholder)},prefilledData:${jsString(field.id)}}`
  ).join(",");
}

function extraTypeIdsSource(): string {
  return BRASSHR_TEMPLATE_EDITOR_SIGNING_FIELDS.map((field) => jsString(field.id)).join(",");
}

function dropdownEntriesSource(): string {
  return BRASSHR_TEMPLATE_EDITOR_SIGNING_FIELDS.filter(
    (field) => !BUILTIN_PREFILLED_VALUES.has(field.id)
  )
    .map((field) => `{value:${jsString(field.id)},label:${jsString(field.label)}}`)
    .join(",");
}

export type FirmaTemplateEditorPalettePatchResult = {
  source: string;
  patched: boolean;
  missingAnchors: string[];
};

/** Returns the editor source with BrassHR signing fields added to Field Types. */
export function patchFirmaTemplateEditorFieldPalette(
  source: string
): FirmaTemplateEditorPalettePatchResult {
  const missingAnchors: string[] = [];
  if (!source.includes(ALLOWED_TYPES_ANCHOR)) missingAnchors.push("allowed-types");
  if (!source.includes(PALETTE_ANCHOR)) missingAnchors.push("palette");
  if (!source.includes(PRESET_ANCHOR)) missingAnchors.push("presets");
  if (!source.includes(COERCE_ANCHOR)) missingAnchors.push("coerce-to-text");
  if (!source.includes(PREFILLED_DROPDOWN_ANCHOR)) missingAnchors.push("prefilled-dropdown");
  if (missingAnchors.length > 0) {
    return { source, patched: false, missingAnchors };
  }

  const allowedIds = extraTypeIdsSource();
  const paletteInsert = paletteEntriesSource();
  const next = source
    .replace(
      ALLOWED_TYPES_ANCHOR,
      `gne=["name","email","phone","company","title",${allowedIds},"text","date","number","checkbox","dropdown","radio","textarea","url","file"]`
    )
    .replace(
      PALETTE_ANCHOR,
      `{id:"title",nameKey:"templateEditor.titleField",icon:w.jsx(et,{icon:"fa-solid fa-briefcase",size:16}),descriptionKey:"templateEditor.titleFieldDesc",designation:"shared"},${paletteInsert},{id:"separator-2"`
    )
    .replace(
      PRESET_ANCHOR,
      `company:{label:"Company Name",placeholder:"Enter company name",prefilledData:"company"},${presetEntriesSource()},signing_date:`
    )
    .replace(
      COERCE_ANCHOR,
      `["name","phone","email","title","company",${allowedIds}].includes(S.type)?C.type="text"`
    )
    .replace(
      PREFILLED_DROPDOWN_ANCHOR,
      `{value:"country",label:"Country"},${dropdownEntriesSource()},{value:"title",label:"Title"}`
    );

  return { source: next, patched: true, missingAnchors: [] };
}
