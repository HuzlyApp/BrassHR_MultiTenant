// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RecruiterTemplateBuilderForm from "./RecruiterTemplateBuilderForm";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), replace: vi.fn(), push: vi.fn(), params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, push: mocks.push }), useSearchParams: () => mocks.params }));
vi.mock("@/app/components/tenant/TenantBrandingContext", () => ({ useTenantBranding: () => ({ id: "tenant", slug: "test" }) }));
vi.mock("./FirmaTemplateBuilderFrame", () => ({ default: () => null }));
vi.mock("./recruiter-template-auth", () => ({ recruiterTemplateFetch: mocks.fetch }));
beforeEach(() => { vi.clearAllMocks(); mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ template: { id: "saved-id", name: "Offer", category: "offer_letter", expiration_hours: 168, status: "draft", document_file_name: null, document_storage_path: null, firma_template_id: null } }) }); });
describe("template draft saving", () => {
  it("shows an inline required name error without a request", () => {
    render(<RecruiterTemplateBuilderForm />);
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Template name is required.");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("opens the saved template after creating a valid draft", async () => {
    render(<RecruiterTemplateBuilderForm />);
    fireEvent.change(screen.getByLabelText("Template Name"), { target: { value: "Offer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/admin_recruiter/template-builder/saved-id"));
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
