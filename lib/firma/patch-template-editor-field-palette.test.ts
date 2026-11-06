import { describe, expect, it } from "vitest";
import {
  BRASSHR_TEMPLATE_EDITOR_SIGNING_FIELDS,
  patchFirmaTemplateEditorFieldPalette,
} from "@/lib/firma/patch-template-editor-field-palette";

const FIXTURE = [
  'gne=["name","email","phone","company","title","text","date","number","checkbox","dropdown","radio","textarea","url","file"]',
  '{id:"title",nameKey:"templateEditor.titleField",icon:w.jsx(et,{icon:"fa-solid fa-briefcase",size:16}),descriptionKey:"templateEditor.titleFieldDesc",designation:"shared"},{id:"separator-2",nameKey:""}',
  'company:{label:"Company Name",placeholder:"Enter company name",prefilledData:"company"},signing_date:{label:"Signing Date"}',
  '["name","phone","email","title","company"].includes(S.type)?C.type="text"',
  '{value:"country",label:"Country"},{value:"title",label:"Title"}',
].join("\n");

describe("patchFirmaTemplateEditorFieldPalette", () => {
  it("inserts First Name and the rest of the signing fields into the editor palette", () => {
    const result = patchFirmaTemplateEditorFieldPalette(FIXTURE);
    expect(result.patched).toBe(true);
    expect(result.missingAnchors).toEqual([]);
    for (const field of BRASSHR_TEMPLATE_EDITOR_SIGNING_FIELDS) {
      expect(result.source).toContain(`id:${JSON.stringify(field.id)}`);
      expect(result.source).toContain(`nameKey:${JSON.stringify(field.label)}`);
      expect(result.source).toContain(`prefilledData:${JSON.stringify(field.id)}`);
      expect(result.source).toContain(JSON.stringify(field.id));
    }
    expect(result.source).toContain('"first_name"');
    expect(result.source).toContain('"last_name"');
    expect(result.source).toContain('C.type="text"');
    expect(result.source).toContain('{value:"date_of_birth",label:"Date of Birth"}');
    expect(result.source).toContain('{value:"pay_rate",label:"Pay Rate"}');
    expect(result.source).not.toContain('{value:"first_name",label:"First Name"}');
  });

  it("leaves the script unchanged when Firma's palette anchors move", () => {
    const result = patchFirmaTemplateEditorFieldPalette("unrelated editor build");
    expect(result.patched).toBe(false);
    expect(result.source).toBe("unrelated editor build");
    expect(result.missingAnchors.length).toBeGreaterThan(0);
  });
});
