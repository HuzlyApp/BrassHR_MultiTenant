# Firma.dev Template Builder

Admin recruiters can create, configure, preview, publish, and manage Firma.dev e-signature templates at:

`/admin_recruiter/template-builder`

## Environment variables

Add these to your server environment (never expose the API key to the client):

```env
# Required for publish/preview/signing-request flows
FIRMA_API_KEY=firma_test_...

# Optional global fallback workspace when a tenant has no firma_workspace_id
FIRMA_WORKSPACE_ID=

# Optional overrides
FIRMA_API_BASE_URL=https://api.firma.dev/functions/v1/signing-request-api
FIRMA_EDITOR_APP_URL=https://app.firma.dev
FIRMA_EMBED_SCRIPT_URL=https://api.firma.dev/functions/v1/embed-proxy/template-editor.js
```

### Per-tenant workspace

Each organization can set `tenants.firma_workspace_id` in **Account Settings → Firma E-Signature**, or via `PATCH /api/admin/tenant-firma-settings`. When set, all Firma API calls for that tenant use that workspace. When null, the server falls back to `FIRMA_WORKSPACE_ID`.

Apply migration `supabase/migrations/20260624120000_tenant_firma_workspace.sql` for tenant/template/session workspace columns.

### Auth pattern

Firma accepts the API key directly in the `Authorization` header (no `Bearer` prefix required). This app sends the raw key from server-side API routes only.

Use a **test key** (`firma_test_...`) during local development. Firma test keys do not consume credits and watermark signing requests.

## Local MCP setup (Cursor)

The repo already wires Firma MCP servers in `.cursor/mcp.json`:

- **Docs MCP** (`https://docs.firma.dev/mcp`) — lookup API schemas and guides
- **Data MCP** (`https://mcp.firma.dev/mcp`) — OAuth-backed workspace operations

For day-to-day development:

1. Keep `FIRMA_API_KEY` in `.env` for the Next.js server.
2. Use Firma Docs MCP when verifying endpoint shapes before changing `lib/firma/client.ts`.
3. Use Firma Data MCP only when you intentionally need live workspace/template operations.

## Database

Apply migration:

`supabase/migrations/20260616180000_recruiter_templates.sql`

Tables:

- `recruiter_templates`
- `recruiter_template_roles`
- `recruiter_template_fields`

Storage bucket: `recruiter-template-documents`

## API routes

| Route | Purpose |
|---|---|
| `GET/POST /api/admin/recruiter-templates` | List / create |
| `GET/PATCH/DELETE /api/admin/recruiter-templates/[id]` | Read / update / archive |
| `POST /api/admin/recruiter-templates/[id]/publish` | Publish to Firma |
| `POST /api/admin/recruiter-templates/[id]/duplicate` | Duplicate local template |
| `GET /api/admin/recruiter-templates/[id]/preview` | Preview + JWT for embed |
| `POST /api/admin/recruiter-templates/[id]/document` | Upload PDF/DOCX draft |
| `POST /api/admin/recruiter-templates/[id]/signing-request` | Create Firma signing request |

All routes require staff auth via `requireStaffApiSession()` and tenant scoping via `resolveEffectiveAdminTenantId()`.

## Publish flow

1. Save draft locally (roles, field mappings, metadata).
2. Upload a PDF or DOCX document.
3. Publish — creates or updates the Firma template and stores `firma_template_id`.
4. Preview — uses `POST /generate-template-token` and the embeddable template editor (`readOnly` in preview mode).

## Tests

```bash
npm test -- lib/recruiter-templates/recruiter-templates.test.ts
```
