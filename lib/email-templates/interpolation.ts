import type { EmailTemplateVariable } from "@/lib/email-templates/types";
import { EmailTemplateError } from "@/lib/email-templates/errors";

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

export function validateVariableDefinitions(variables: EmailTemplateVariable[]): void {
  const seen = new Set<string>();
  for (const v of variables) {
    const key = v.key?.trim();
    if (!key || !/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key)) {
      throw new EmailTemplateError("VALIDATION_ERROR", `Invalid variable key: ${v.key ?? ""}`, 400);
    }
    if (seen.has(key)) {
      throw new EmailTemplateError("VALIDATION_ERROR", `Duplicate variable key: ${key}`, 400);
    }
    seen.add(key);
  }
}

export function validatePlaceholdersAllowed(content: string, allowedKeys: Set<string>): void {
  for (const match of content.matchAll(PLACEHOLDER_RE)) {
    const key = match[1];
    if (key && !allowedKeys.has(key)) {
      throw new EmailTemplateError(
        "VALIDATION_ERROR",
        `Placeholder {{${key}}} is not declared in variables`,
        400,
        { key }
      );
    }
  }
}
