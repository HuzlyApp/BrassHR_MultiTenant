import { grantAllows, type StoredGrant } from "@/lib/auth/permission-catalog";

// Compatibility projection of the existing module grants. This never creates
// additional authority: create/approve/manage use Edit, consistent with the UI.
const mappings: Array<{ resource: string; action: "view" | "edit" | "delete"; keys: string[]; feature?: string }> = [
  { resource: "people", action: "view", keys: ["workers.read"] },
  { resource: "people", action: "edit", keys: ["workers.create", "workers.update"] },
  { resource: "people", action: "delete", keys: ["workers.delete"] },
  { resource: "scheduling", action: "view", keys: ["shifts.read", "worker_requests.read"] },
  { resource: "scheduling", action: "edit", keys: ["shifts.create", "shifts.update", "shifts.assign", "worker_requests.approve"] },
  { resource: "scheduling", action: "view", keys: ["timesheets.read", "clockins.read"], feature: "timesheets" },
  { resource: "scheduling", action: "edit", keys: ["timesheets.approve", "timesheets.reject", "clockins.manage"], feature: "timesheets" },
  { resource: "settings_company", action: "view", keys: ["departments.read"] },
  { resource: "settings_company", action: "edit", keys: ["departments.manage", "users.manage", "roles.manage", "features.manage"] },
  { resource: "organization", action: "view", keys: ["clients.read"], feature: "manage_clients" },
  { resource: "organization", action: "edit", keys: ["clients.manage"], feature: "manage_clients" },
  { resource: "jobs", action: "view", keys: ["job_requisitions.read"], feature: "hiring_pipeline" },
  { resource: "jobs", action: "edit", keys: ["job_requisitions.manage"], feature: "hiring_pipeline" },
  { resource: "hiring", action: "view", keys: ["applicants.read"], feature: "hiring_pipeline" },
  { resource: "hiring", action: "edit", keys: ["applicants.update"], feature: "hiring_pipeline" },
  // Help is always granted in the legacy system; it is not staff ticket-management authority.
];

export function atomicPermissions(grants: Array<{ key: string } & StoredGrant>, features: Record<string, boolean>) {
  const byKey = new Map(grants.map((grant) => [grant.key, grant]));
  return [...new Set(mappings.filter((mapping) =>
    (!mapping.feature || features[mapping.feature] === true) && grantAllows(byKey.get(mapping.resource) ?? null, mapping.action),
  ).flatMap((mapping) => mapping.keys))].sort();
}
