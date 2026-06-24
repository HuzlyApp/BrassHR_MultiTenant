/**
 * One-off probe: official Firma workspace creation API.
 *
 * Docs: https://docs.firma.dev/guides/creating-workspaces
 * Endpoint: POST https://api.firma.dev/functions/v1/signing-request-api/workspaces
 *
 * Run once with a test key only:
 *   npx tsx scripts/test-firma-create-workspace.ts
 *
 * Optional: pass --list-only to run GET /workspaces without creating.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const DEFAULT_API_BASE = "https://api.firma.dev/functions/v1/signing-request-api";

function loadEnvFile() {
  const envPath = resolve(root, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function redactSecrets(text: string): string {
  return text
    .replace(/firma_(live|test)_[A-Za-z0-9_-]+/g, "firma_$1_[REDACTED]")
    .replace(/"api_key"\s*:\s*"[^"]+"/g, '"api_key":"[REDACTED]"')
    .replace(/"test_api_key"\s*:\s*"[^"]+"/g, '"test_api_key":"[REDACTED]"');
}

function getApiBase(): string {
  return (process.env.FIRMA_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/$/, "");
}

async function firmaFetch(path: string, init?: RequestInit) {
  const apiKey = process.env.FIRMA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing FIRMA_API_KEY");
  }

  const url = `${getApiBase()}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const bodyText = await response.text();
  return { url, response, bodyText };
}

function failOnUnsafeStatus(status: number, bodyText: string): never {
  console.error("Unsafe or unsupported response — stopping without retry.");
  console.error("Status:", status);
  console.error("Body:", redactSecrets(bodyText));
  process.exit(1);
}

async function main() {
  loadEnvFile();

  const apiKey = process.env.FIRMA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing FIRMA_API_KEY");
  }

  if (!apiKey.startsWith("firma_test_")) {
    throw new Error(
      "Refusing to run: FIRMA_API_KEY must be a test key (firma_test_...) for this script"
    );
  }

  const listOnly = process.argv.includes("--list-only");

  console.log("=== GET /workspaces (non-mutating list probe) ===");
  const list = await firmaFetch("/workspaces?page=1&page_size=5");
  console.log("URL:", list.url);
  console.log("Status:", list.response.status);
  console.log("Body:", redactSecrets(list.bodyText));

  if ([401, 403, 404, 405].includes(list.response.status)) {
    failOnUnsafeStatus(list.response.status, list.bodyText);
  }

  if (listOnly) {
    console.log("List-only mode — skipping POST /workspaces");
    return;
  }

  const workspaceName = `BrassHR API Test Workspace ${new Date().toISOString()}`;
  console.log("\n=== POST /workspaces (one-off create) ===");
  console.log("Name:", workspaceName);

  const create = await firmaFetch("/workspaces", {
    method: "POST",
    body: JSON.stringify({ name: workspaceName }),
  });

  console.log("URL:", create.url);
  console.log("Status:", create.response.status);
  console.log("Body:", redactSecrets(create.bodyText));

  if ([401, 403, 404, 405].includes(create.response.status)) {
    failOnUnsafeStatus(create.response.status, create.bodyText);
  }

  if (create.response.status === 201) {
    try {
      const parsed = JSON.parse(create.bodyText) as { id?: string; name?: string };
      console.log("\nCreated workspace ID:", parsed.id ?? "(not present in body)");
      console.log("Created workspace name:", parsed.name ?? workspaceName);
      console.log(
        "\nNote: delete this disposable workspace in the Firma dashboard if you do not need it."
      );
    } catch {
      console.log("\n201 response received but body was not JSON.");
    }
  } else {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
