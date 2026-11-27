// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import EmailTemplatesPanel from "./EmailTemplatesPanel";
vi.mock("@/lib/supabase-browser", () => ({ supabaseBrowser: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
afterEach(() => { vi.unstubAllGlobals(); });
beforeEach(() => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ templates: [{ template_key: "welcome", name: "Welcome", variables: [{ key: "first_name", sample: "Alice" }], subject: "Hello {{first_name}}", body_html: "<p>Hello</p>", body_text: "Welcome", from_email_local_part: "hr" }] }) })); });
describe("email template editing tools", () => {
  it("substitutes useful preview samples and restores default draft content", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ tenantName: "Zippy Corp", templates: [{ template_key: "welcome", name: "Welcome", variables: [{ key: "tenantName", sample: "[tenantName]" }, { key: "applicantName", sample: "[applicantName]" }, { key: "supportEmail", sample: "[supportEmail]" }], subject: "Welcome to {{tenantName}}", body_html: "<p>Hi {{applicantName}}. Questions? {{supportEmail}}</p>", defaults: { subject: "Default subject", body_html: "<p>Default welcome</p>", body_text: "Default welcome" } }] }) } as Response);
    vi.stubGlobal("confirm", vi.fn(() => true));
    render(<EmailTemplatesPanel />);
    fireEvent.click(await screen.findByRole("button", { name: /Welcome email/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Preview email" }));
    expect(screen.getByRole("heading", { name: "Welcome to Zippy Corp" })).toBeInTheDocument();
    expect(screen.getByTitle("Email body preview")).toHaveAttribute("srcdoc", expect.stringContaining("Hi Alex Morgan. Questions? support@example.com"));
    fireEvent.click(screen.getByRole("button", { name: "Reset to default" }));
    expect(screen.getByLabelText("Email body (HTML)")).toHaveValue("<p>Default welcome</p>");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("inserts a placeholder at the body cursor without replacing surrounding content", async () => {
    render(<EmailTemplatesPanel />);
    fireEvent.click(await screen.findByRole("button", { name: /Welcome email/i }));
    const body = await screen.findByLabelText("Email body (HTML)");
    act(() => body.focus());
    (body as HTMLTextAreaElement).setSelectionRange(3, 3);
    fireEvent.click(screen.getByRole("button", { name: "{{first_name}}" }));
    await waitFor(() => expect(screen.getByLabelText("Email body (HTML)")).toHaveValue("<p>{{first_name}}Hello</p>"));
  });
  it("previews the draft with sample variables in a sandboxed frame", async () => {
    render(<EmailTemplatesPanel />);
    fireEvent.click(await screen.findByRole("button", { name: /Welcome email/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Preview email" }));
    expect(screen.getByRole("heading", { name: "Hello Alice" })).toBeInTheDocument();
    expect(screen.getByTitle("Email body preview")).toHaveAttribute("sandbox", "");
    expect(screen.getByTitle("Email body preview")).toHaveAttribute("srcdoc", expect.stringContaining("<p>Hello</p>"));
    fireEvent.click(screen.getByRole("button", { name: "Hide preview" }));
    expect(screen.queryByTitle("Email body preview")).toBeNull();
  });
});
