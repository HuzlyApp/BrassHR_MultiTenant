/**
 * One-off diagnostic: compare Firma company/workspace appearance vs JWT color_palette.
 * Usage: node scripts/diagnose-firma-appearance.mjs [workspaceId] [firmaTemplateId]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  const text = readFileSync(path, "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

function decodeJwtPayload(token) {
  const part = token.split(".")[1];
  if (!part) return null;
  const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  return JSON.parse(json);
}

async function main() {
  const env = loadEnvLocal();
  const apiKey = env.FIRMA_API_KEY;
  const base = (env.FIRMA_API_BASE_URL ?? "https://api.firma.dev/functions/v1/signing-request-api").replace(/\/$/, "");
  const workspaceId = process.argv[2] ?? "3a08ca02-5283-4ead-b998-965bf57c121c";
  const templateId = process.argv[3];

  if (!apiKey) throw new Error("Missing FIRMA_API_KEY in .env.local");

  const headers = { Authorization: apiKey, "Content-Type": "application/json" };

  const workspacesRes = await fetch(`${base}/workspaces`, { headers });
  const workspacesBody = await workspacesRes.json();
  const workspaces = workspacesBody.results ?? [];
  console.log("\n=== Workspaces ===");
  for (const ws of workspaces) {
    console.log(`- ${ws.id}  ${ws.name ?? ""}`);
  }

  const companySettings = await fetch(`${base}/company/settings`, { headers }).then((r) => r.json());
  console.log("\n=== Company appearance ===");
  console.log(JSON.stringify(pickColors(companySettings), null, 2));

  const match = workspaces.find((ws) => ws.id === workspaceId);
  const wsKey = match?.api_key;
  if (!wsKey) {
    console.error(`Workspace ${workspaceId} not found in /workspaces list`);
    process.exit(1);
  }

  const workspaceSettings = await fetch(`${base}/workspace/${workspaceId}/settings`, {
    headers: { Authorization: wsKey },
  }).then((r) => r.json());
  console.log(`\n=== Workspace ${workspaceId} appearance ===`);
  console.log(JSON.stringify(pickColors(workspaceSettings), null, 2));

  if (templateId) {
    const tokenRes = await fetch(`${base}/generate-template-token?workspace_id=${workspaceId}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ companies_workspaces_templates_id: templateId }),
    });
    const tokenBody = await tokenRes.json();
    console.log("\n=== generate-template-token response keys ===");
    console.log(Object.keys(tokenBody));
    if (tokenBody.color_palette) {
      console.log("\n=== color_palette (response body) ===");
      console.log(JSON.stringify(tokenBody.color_palette, null, 2));
    }
    if (tokenBody.token) {
      const payload = decodeJwtPayload(tokenBody.token);
      console.log("\n=== JWT payload keys ===");
      console.log(Object.keys(payload ?? {}));
      if (payload?.color_palette) {
        console.log("\n=== color_palette (JWT) ===");
        console.log(JSON.stringify(payload.color_palette, null, 2));
      }
      if (payload?.appearance) {
        console.log("\n=== appearance (JWT) ===");
        console.log(JSON.stringify(payload.appearance, null, 2));
      }
    }
  }
}

function pickColors(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith("color_") || key === "color_palette") out[key] = value;
  }
  return out;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
