import { PromptValidationError } from "./errors";

type JsonSchema = {
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  required?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  additionalProperties?: boolean | JsonSchema;
};

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function typeMatches(expected: string | string[] | undefined, value: unknown): boolean {
  if (!expected) return true;
  const actual = typeOf(value);
  const list = Array.isArray(expected) ? expected : [expected];
  if (list.includes("integer")) {
    return Number.isInteger(value) || list.filter((t) => t !== "integer").includes(actual);
  }
  return list.includes(actual);
}

function walk(path: string, schema: JsonSchema, value: unknown, errors: string[]): void {
  if (!typeMatches(schema.type, value)) {
    errors.push(`${path}: expected ${String(schema.type)}, got ${typeOf(value)}`);
    return;
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: value is not an allowed enum`);
  }
  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${path}: value does not match const`);
  }
  if (typeof value === "number") {
    if (schema.type === "integer" && !Number.isInteger(value)) {
      errors.push(`${path}: expected integer score`);
    }
    if (schema.minimum != null && value < schema.minimum) {
      errors.push(`${path}: below minimum ${schema.minimum}`);
    }
    if (schema.maximum != null && value > schema.maximum) {
      errors.push(`${path}: above maximum ${schema.maximum}`);
    }
  }
  if (typeof value === "string") {
    if (schema.minLength != null && value.length < schema.minLength) {
      errors.push(`${path}: shorter than minLength`);
    }
    if (schema.maxLength != null && value.length > schema.maxLength) {
      errors.push(`${path}: longer than maxLength`);
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) {
      errors.push(`${path}: fewer than minItems`);
    }
    if (schema.maxItems != null && value.length > schema.maxItems) {
      errors.push(`${path}: more than ${schema.maxItems} items`);
    }
    if (schema.items) {
      value.forEach((item, index) => walk(`${path}[${index}]`, schema.items as JsonSchema, item, errors));
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in obj)) errors.push(`${path}.${key}: required`);
    }
    const props = schema.properties ?? {};
    for (const [key, child] of Object.entries(props)) {
      if (key in obj) walk(`${path}.${key}`, child, obj[key], errors);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(obj)) {
        if (!(key in props)) errors.push(`${path}.${key}: additional property not allowed`);
      }
    }
  }
}

export function parseJsonObject(text: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "Response is not a JSON object" };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, error: "Invalid JSON" };
  }
}

export function validateAgainstJsonSchema(
  value: unknown,
  schema: Record<string, unknown> | null | undefined
): string[] {
  if (!schema || typeof schema !== "object") {
    return ["Response schema is missing from the prompt version"];
  }
  const errors: string[] = [];
  walk("$", schema as JsonSchema, value, errors);
  return errors;
}

export function assertValidModelResponse(
  value: unknown,
  schema: Record<string, unknown> | null | undefined
): void {
  const errors = validateAgainstJsonSchema(value, schema);
  if (errors.length) throw new PromptValidationError(errors);
}
