// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import HireJourneyThemePanel from "./HireJourneyThemePanel";
import { EMPTY_HIRE_JOURNEY_THEME } from "@/lib/tenant/hire-journey-theme";
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/app/components/tenant/TenantBrandingContext", () => ({ useTenantBranding: () => ({ primaryHex: "#D48F09", secondaryHex: "#111111" }) }));
vi.mock("./HireJourneyPreview", () => ({ default: () => null }));
vi.mock("@/app/tenant-onboarding/BrandingColorField", () => ({ default: (props: { label: string; value: string; onChange: (value: string) => void }) => <input aria-label={props.label} value={props.value} onChange={event => props.onChange(event.target.value)} /> }));
beforeEach(() => {
  mocks.fetch.mockReset().mockImplementation(async (_url: string, init?: RequestInit) => ({ ok: true, json: async () => ({ theme: init?.method === "PUT" ? EMPTY_HIRE_JOURNEY_THEME : { progressBackgroundColor: "#ABCDEF", stepIconColor: "#123456" } }) }));
  vi.stubGlobal("fetch", mocks.fetch);
});
describe("hiring journey branding defaults", () => {
  it("restores the latest editor colors instead of stale context colors", async () => {
    render(<QueryClientProvider client={new QueryClient()}><HireJourneyThemePanel embedded brandDefaults={{ primaryHex: "#00B7B6", secondaryHex: "#104B83" }} /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByLabelText("Progress background")).toHaveValue("#ABCDEF"));
    expect(screen.getAllByText(/Saved custom color/)).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Use branding colors" }));
    await waitFor(() => expect(screen.getByLabelText("Progress background")).toHaveValue("#00B7B6"));
    expect(screen.getByLabelText("Step icon color")).toHaveValue("#104B83");
  });
  it("retains unrelated saved colors when editing one field", async () => {
    render(<QueryClientProvider client={new QueryClient()}><HireJourneyThemePanel embedded brandDefaults={{ primaryHex: "#00B7B6", secondaryHex: "#104B83" }} /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByLabelText("Progress background")).toHaveValue("#ABCDEF"));
    fireEvent.change(screen.getByLabelText("Step modal buttons"), { target: { value: "#222222" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
    expect(JSON.parse(mocks.fetch.mock.calls[1][1].body)).toMatchObject({ progressBackgroundColor: "#ABCDEF", stepIconColor: "#123456", modalButtonColor: "#222222", defaults: { primaryHex: "#00B7B6", secondaryHex: "#104B83" } });
  });
});
