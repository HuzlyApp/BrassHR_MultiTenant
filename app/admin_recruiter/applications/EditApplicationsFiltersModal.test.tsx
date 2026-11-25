/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EditApplicationsFiltersModal, EMPTY_APPLICATIONS_EXTENDED_FILTERS } from "./EditApplicationsFiltersModal";
vi.mock("@/app/components/tenant/TenantBrandingContext", () => ({ useTenantBranding: () => ({}) }));
vi.mock("@/lib/tenant/tenant-branding", () => ({ brandingToCssVars: () => ({}) }));

describe("applicant filter reset", () => {
  it("clears parent toolbar/search filters as well as modal draft filters", () => {
    const onClear = vi.fn();
    const onSave = vi.fn();
    render(<EditApplicationsFiltersModal open onOpenChange={vi.fn()} value={{ ...EMPTY_APPLICATIONS_EXTENDED_FILTERS, matchStatus: "Strong", client: "Acme" }} options={{ statuses: [], stages: [], locations: [], workflows: [], jobs: [], clients: ["Acme"], assignees: [] }} onSave={onSave} onClear={onClear} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear All" }));
    expect(onClear).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Apply Filter" }));
    expect(onSave).toHaveBeenCalledWith(EMPTY_APPLICATIONS_EXTENDED_FILTERS);
  });
});
