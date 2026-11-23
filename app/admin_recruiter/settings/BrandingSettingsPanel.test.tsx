// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import BrandingSettingsPanel from "./BrandingSettingsPanel";
import { defaultTenantBranding } from "@/lib/tenant/tenant-branding";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), section: "colors" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/settings/branding",
  useSearchParams: () => new URLSearchParams({ section: mocks.section }),
}));
vi.mock("@/lib/staff-auth-headers", () => ({ staffFetchInit: async () => ({}) }));
vi.mock("@/app/components/tenant/TenantBrandingContext", () => ({ useTenantBranding: () => defaultTenantBranding() }));
vi.mock("./BrandingAuthPreview", () => ({ default: () => null }));
vi.mock("./HireJourneyThemePanel", () => ({ default: () => null }));
vi.mock("@/lib/tenant/branding-events", () => ({ notifyBrandingUpdated: vi.fn() }));

const saved = { ...defaultTenantBranding(), primaryHex: "#123456", secondaryHex: "#234567", accentHex: "#345678" };
function mount() {
  return render(<QueryClientProvider client={new QueryClient()}><BrandingSettingsPanel /></QueryClientProvider>);
}
beforeEach(() => {
  mocks.section = "colors";
  mocks.fetch.mockReset().mockResolvedValue({ ok: true, json: async () => ({ tenantId: "tenant", branding: saved }) });
  vi.stubGlobal("fetch", mocks.fetch);
});
describe("branding edits", () => {
  it("rejects invalid logo uploads and handles broken previews", async () => {
    mocks.section = "logo";
    const { container } = mount();
    const field = await screen.findByLabelText("Upload Company logo");
    fireEvent.change(field, { target: { files: [new File(["text"], "logo.txt", { type: "text/plain" })] } });
    expect(screen.getByRole("alert")).toHaveTextContent("Use PNG, JPG, WEBP, or SVG, up to 2 MB.");
    expect(container.querySelector('img[src^="blob:"]')).toBeNull();
    const image = screen.getByAltText("Company logo preview");
    fireEvent.error(image);
    expect(screen.queryByAltText("Company logo preview")).toBeNull();
  });
  it("keeps a visible confirmation after saving", async () => {
    const { container } = mount();
    await waitFor(() => expect(screen.getByLabelText("Primary color hex")).toHaveValue("#123456"));
    fireEvent.submit(container.querySelector("form")!);
    expect(await screen.findByRole("status")).toHaveTextContent("Branding saved successfully.");
  });
  it("restores saved colors on Cancel without reloading", async () => {
    mount();
    await waitFor(() => expect(screen.getByLabelText("Primary color hex")).toHaveValue("#123456"));
    fireEvent.click(screen.getByRole("button", { name: "Purple" }));
    expect(screen.getByLabelText("Primary color hex")).not.toHaveValue("#123456");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByLabelText("Primary color hex")).toHaveValue("#123456");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it("shows invalid hex input without changing the swatch and clears it on Cancel", async () => {
    mount();
    await waitFor(() => expect(screen.getByLabelText("Accent color hex")).toHaveValue("#345678"));
    fireEvent.change(screen.getByLabelText("Accent color hex"), { target: { value: "zzz" } });
    expect(screen.getByRole("alert")).toHaveTextContent("six-digit hex");
    expect(screen.getByLabelText("Accent color")).toHaveValue("#345678");
    expect(screen.getByLabelText("Accent color hex")).toBeInvalid();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByLabelText("Accent color hex")).toHaveValue("#345678");
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("clears pending logo selection on Cancel", async () => {
    mocks.section = "logo";
    const { container } = mount();
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-logo");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const fileInput = container.querySelector('input[type="file"]')!;
    fireEvent.change(fileInput, { target: { files: [new File(["image"], "logo.png", { type: "image/png" })] } });
    await waitFor(() => expect(container.querySelector('img[src="blob:test-logo"]')).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(container.querySelector('img[src="blob:test-logo"]')).toBeNull();
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
    expect(mocks.fetch.mock.calls.every(([url]) => url === "/api/admin/branding")).toBe(true);
  });
  it("explains the headline limit and rejects an empty headline", async () => {
    mocks.section = "backgrounds";
    const { container } = mount();
    const field = await screen.findByLabelText(/Login headline/);
    expect(field).toHaveAttribute("maxlength", "120");
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.submit(container.querySelector("form")!);
    expect(await screen.findByText("Login headline is required and must be 120 characters or fewer.")).toBeInTheDocument();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
});
