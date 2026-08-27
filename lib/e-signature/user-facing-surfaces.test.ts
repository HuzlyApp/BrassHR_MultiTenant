import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  E_SIGNATURE_LABEL,
  E_SIGNATURE_SETTINGS_LABEL,
  E_SIGNATURE_WORKSPACE_LABEL,
  sanitizeESignatureUserMessage,
} from "@/lib/e-signature/user-facing";

const ROOT = process.cwd();

/** Screens and copy helpers that must not disclose the provider to end users. */
const USER_FACING_FILES = [
  "app/admin_recruiter/account/components/FirmaIntegrationPanel.tsx",
  "app/admin_recruiter/components/RecruiterTemplateBuilderForm.tsx",
  "app/admin_recruiter/components/FirmaTemplateBuilderFrame.tsx",
  "app/admin_recruiter/components/FirmaTemplateEditorEmbed.tsx",
  "app/admin_recruiter/hooks/useWorkerDocumentReview.ts",
  "app/admin_recruiter/new/authorization/[id]/page.tsx",
  "app/admin_recruiter/components/RecruiterTemplatesList.tsx",
  "app/application/authorizations-documents/page.tsx",
  "app/application/employee-agreement/page.tsx",
  "app/application/firma-sign/page.tsx",
  "app/components/onboarding/AuthorizationsFirmaAgreementPanel.tsx",
  "app/components/onboarding/FirmaTemplateSelect.tsx",
  "app/components/workflow-builder/StepsSettingsPanel.tsx",
  "app/components/workflow-builder/step-preview/StepPreviewBodies.tsx",
  "app/tenant-onboarding/tenant-onboarding-steps.tsx",
];

function extractDoubleQuotedStrings(source: string): string[] {
  const out: string[] = [];
  const re = /"((?:\\.|[^"\\])*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    out.push(match[1].replace(/\\"/g, '"'));
  }
  return out;
}

function isInternalIdentifier(str: string): boolean {
  return (
    /firma[_-]?(workspace|template|sign|status|provision|signing|esign|request)/i.test(str) ||
    /\/api\/.*firma/i.test(str) ||
    /^firma-/i.test(str) ||
    str.includes("FirmaSigning") ||
    str.includes("FirmaTemplate") ||
    str.includes("FirmaIntegration") ||
    str.includes("FirmaOnboarding") ||
    str.includes("firma_workspace") ||
    str.includes("firma_status") ||
    str.includes("firma_template") ||
    str.includes("signing_provider") ||
    str.includes("[firma-") ||
    str.includes("[e-signature-")
  );
}

describe("E-Signature user-facing copy", () => {
  it("exposes standard product labels", () => {
    expect(E_SIGNATURE_LABEL).toBe("E-Signature");
    expect(E_SIGNATURE_WORKSPACE_LABEL).toBe("E-Signature Workspace");
    expect(E_SIGNATURE_SETTINGS_LABEL).toBe("E-Signature Settings");
  });

  it("sanitizes provider names and hosts from user messages", () => {
    expect(
      sanitizeESignatureUserMessage("Firma API returned 401 from https://api.firma.dev/x")
    ).not.toMatch(/firma/i);
    expect(sanitizeESignatureUserMessage("Failed to create Firma signing request")).not.toMatch(
      /firma/i
    );
  });

  it("keeps user-facing UI double-quoted copy free of Firma / firma.dev", () => {
    const leaks: string[] = [];
    for (const rel of USER_FACING_FILES) {
      const source = readFileSync(join(ROOT, rel), "utf8");
      for (const str of extractDoubleQuotedStrings(source)) {
        if (!/\bfirma\.dev\b/i.test(str) && !/\bFirma\b/.test(str) && !/\bFIRMA\b/.test(str)) {
          continue;
        }
        if (isInternalIdentifier(str)) continue;
        leaks.push(`${rel}: ${str.slice(0, 140)}`);
      }
    }
    expect(leaks).toEqual([]);
  });
});
