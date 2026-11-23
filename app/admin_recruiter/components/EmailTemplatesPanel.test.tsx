// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import EmailTemplatesPanel from "./EmailTemplatesPanel";
vi.mock("@/lib/supabase-browser", () => ({ supabaseBrowser: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
beforeEach(() => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ templates: [{ template_key: "welcome", name: "Welcome", variables: [{ key: "first_name", sample: "Alice" }], subject: "Hello {{first_name}}", body_html: "<p>Hello</p>", body_text: "Welcome", from_email_local_part: "hr" }] }) })); });
describe("email template editing tools", () => {
  it("inserts a placeholder at the body cursor without replacing surrounding content", async () => {
    render(<EmailTemplatesPanel />);
    const body = await screen.findByLabelText("Email body (HTML)");
    fireEvent.focus(body);
    (body as HTMLTextAreaElement).setSelectionRange(3, 3);
    fireEvent.click(screen.getByRole("button", { name: "{{first_name}}" }));
    await waitFor(() => expect(body).toHaveValue("<p>{{first_name}}Hello</p>"));
  });
  it("previews the draft with sample variables in a sandboxed frame", async () => {
    render(<EmailTemplatesPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Preview email" }));
    expect(screen.getByRole("heading", { name: "Hello Alice" })).toBeInTheDocument();
    expect(screen.getByTitle("Email body preview")).toHaveAttribute("sandbox", "");
    expect(screen.getByTitle("Email body preview")).toHaveAttribute("srcdoc", expect.stringContaining("<p>Hello</p>"));
    fireEvent.click(screen.getByRole("button", { name: "Hide preview" }));
    expect(screen.queryByTitle("Email body preview")).toBeNull();
  });
});
