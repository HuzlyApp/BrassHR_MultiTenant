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

export function extractPlaceholderKeys(content: string): string[] {
  const keys = new Set<string>();
  for (const match of content.matchAll(PLACEHOLDER_RE)) {
    const key = match[1];
    if (key) keys.add(key);
  }
  return [...keys];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type InterpolateOptions = {
  /** Escape substituted values for HTML bodies (default true). */
  escapeForHtml?: boolean;
};

export function interpolateTemplate(
  content: string,
  variables: Record<string, string | null | undefined>,
  options: InterpolateOptions = {}
): string {
  const escapeForHtml = options.escapeForHtml !== false;
  return content.replace(PLACEHOLDER_RE, (_match, key: string) => {
    const raw = variables[key];
    const value = raw == null ? "" : String(raw);
    return escapeForHtml ? escapeHtml(value) : value;
  });
}

export function validateRequiredTemplateVariables(
  definitions: EmailTemplateVariable[],
  variables: Record<string, string | null | undefined>,
  fields: { subject: string; body_html: string; body_text?: string | null }
): void {
  const required = definitions.filter((v) => v.required).map((v) => v.key);
  const missing: string[] = [];

  for (const key of required) {
    const val = variables[key];
    if (val == null || String(val).trim() === "") {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new EmailTemplateError(
      "VALIDATION_ERROR",
      `Missing required template variables: ${missing.join(", ")}`,
      400,
      { missing }
    );
  }

  for (const field of [fields.subject, fields.body_html, fields.body_text ?? ""]) {
    if (!field.trim()) continue;
    for (const key of extractPlaceholderKeys(field)) {
      const def = definitions.find((v) => v.key === key);
      if (def?.required) {
        const val = variables[key];
        if (val == null || String(val).trim() === "") {
          if (!missing.includes(key)) missing.push(key);
        }
      }
    }
  }

  if (missing.length > 0) {
    throw new EmailTemplateError(
      "VALIDATION_ERROR",
      `Missing required template variables: ${missing.join(", ")}`,
      400,
      { missing }
    );
  }
}

export function assertNonEmptyEmailContent(subject: string, bodyHtml: string): void {
  if (!subject.trim()) {
    throw new EmailTemplateError("VALIDATION_ERROR", "Email subject is empty", 400);
  }
  if (!bodyHtml.trim()) {
    throw new EmailTemplateError("VALIDATION_ERROR", "Email body is empty", 400);
  }
}
