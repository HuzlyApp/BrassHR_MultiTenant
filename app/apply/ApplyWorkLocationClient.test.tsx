// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ApplyWorkLocationClient from "./ApplyWorkLocationClient";
const mocks = vi.hoisted(() => ({ push: vi.fn(), store: vi.fn(), preview: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/app/components/tenant/TenantBrandingContext", () => ({ useTenantBranding: () => ({}) }));
vi.mock("@/lib/tenant/tenant-branding", () => ({ brandingToCssVars: () => ({}) }));
vi.mock("@/lib/service-area/apply-location-client", () => ({ writeStoredApplyLocation: mocks.store }));
vi.mock("@/lib/service-area/use-service-area-preview", () => ({ useServiceAreaPreview: mocks.preview }));
vi.mock("@/lib/location/use-us-location-options", () => ({ useUsLocationOptions: (state: string) => ({ stateOptions: ["Texas"], cityOptions: ["Austin"], locationLoading: false, citiesLoading: false, selectedStateCode: state ? "TX" : "", displayStateValue: state }) }));
vi.mock("@/app/tenant-onboarding/SearchableSelectField", () => ({ default: (props: { label: string; value: string; options: string[]; onChange: (value: string) => void }) => <label>{props.label}<select value={props.value} onChange={e => props.onChange(e.target.value)}><option value="" />{props.options.map(option => <option key={option}>{option}</option>)}</select></label> }));
const props = { tenantSlug: "acme", jobToken: "token-a", jobTitle: "Remote engineer", jobCity: "San Antonio", continueHref: "/next" };
beforeEach(() => { vi.clearAllMocks(); mocks.preview.mockReturnValue({ loading: false, allowed: true, message: null }); });
describe("application work location", () => {
  it("uses a remote work location without requiring an on-site answer", () => {
    render(<ApplyWorkLocationClient {...props} jobLocationType="Remote" />);
    expect(screen.queryByText(/Will you work on-site/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Work state"), { target: { value: "Texas" } });
    fireEvent.change(screen.getByLabelText("Work city"), { target: { value: "Austin" } });
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    expect(mocks.store).toHaveBeenCalledWith("acme", "token-a", expect.objectContaining({ city: "Austin", state: "TX", locationType: "remote", relocateToJobSite: false }));
    expect(mocks.push).toHaveBeenCalledWith("/next");
  });
  it("retains on-site questions for hybrid work and service-area gating for remote work", () => {
    const { unmount } = render(<ApplyWorkLocationClient {...props} jobLocationType="Hybrid" />);
    expect(screen.getByText("Will you work on-site at San Antonio?")).toBeInTheDocument();
    unmount(); mocks.preview.mockReturnValue({ loading: false, allowed: false, message: null });
    render(<ApplyWorkLocationClient {...props} jobLocationType="Remote" />);
    fireEvent.change(screen.getByLabelText("Work state"), { target: { value: "Texas" } });
    fireEvent.change(screen.getByLabelText("Work city"), { target: { value: "Austin" } });
    expect(screen.getByRole("button", { name: /Continue/ })).toBeDisabled();
  });
});
