import { describe, expect, it } from "vitest";
import {
  filterTenantConsoleRows,
  tenantStatusLabel,
} from "@/lib/godadmin/filter-tenant-console-rows";
import {
  isTenantDeactivated,
  tenantStatusFromIsActive,
} from "@/lib/godadmin/tenant-account-status";

describe("tenantStatusFromIsActive", () => {
  it("maps true to active", () => {
    expect(tenantStatusFromIsActive(true)).toBe("active");
  });

  it("maps false to deactivated", () => {
    expect(tenantStatusFromIsActive(false)).toBe("deactivated");
  });

  it("treats null/undefined as active", () => {
    expect(tenantStatusFromIsActive(null)).toBe("active");
    expect(tenantStatusFromIsActive(undefined)).toBe("active");
  });
});

describe("isTenantDeactivated", () => {
  it("is true for deactivated and inactive", () => {
    expect(isTenantDeactivated("deactivated")).toBe(true);
    expect(isTenantDeactivated("inactive")).toBe(true);
  });

  it("is false for active", () => {
    expect(isTenantDeactivated("active")).toBe(false);
  });
});

describe("filterTenantConsoleRows", () => {
  const rows = [
    {
      id: "1",
      name: "Acme Corp",
      slug: "acme",
      status: "active" as const,
      created_at: "",
      updated_at: "",
    },
    {
      id: "2",
      name: "Beta LLC",
      slug: "beta",
      status: "deactivated" as const,
      created_at: "",
      updated_at: "",
    },
  ];

  it("filters by status active", () => {
    expect(filterTenantConsoleRows(rows, { status: "active" })).toHaveLength(1);
    expect(filterTenantConsoleRows(rows, { status: "active" })[0]?.slug).toBe("acme");
  });

  it("filters by status deactivated", () => {
    expect(filterTenantConsoleRows(rows, { status: "deactivated" })).toHaveLength(1);
    expect(filterTenantConsoleRows(rows, { status: "deactivated" })[0]?.slug).toBe("beta");
  });

  it("filters by search on name or slug", () => {
    expect(filterTenantConsoleRows(rows, { search: "beta" })).toHaveLength(1);
    expect(filterTenantConsoleRows(rows, { search: "ACME" })).toHaveLength(1);
    expect(filterTenantConsoleRows(rows, { search: "missing" })).toHaveLength(0);
  });
});

describe("tenantStatusLabel", () => {
  it("returns human labels", () => {
    expect(tenantStatusLabel("active")).toBe("Active");
    expect(tenantStatusLabel("deactivated")).toBe("Deactivated");
  });
});
