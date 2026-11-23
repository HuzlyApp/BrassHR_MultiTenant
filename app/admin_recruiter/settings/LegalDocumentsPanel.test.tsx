// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import LegalDocumentsPanel from "./LegalDocumentsPanel";
vi.mock("@/lib/supabase-browser", () => ({ supabaseBrowser: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
vi.mock("./LegalPolicyEditor", () => ({ default: (props: { value: string; onChange: (value: string) => void }) => <textarea aria-label="Policy content" value={props.value} onChange={event => props.onChange(event.target.value)} /> }));
const documents = ["Privacy policy", "Terms policy"].map((title, index) => ({ id: String(index), title, document_key: `policy_${index}`, audience: "all", is_published: true, is_system: false, last_updated_label: null, sections: [{ title: "Policy", paragraphs: ["Saved text"] }], sort_order: index }));
beforeEach(() => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ documents }) })); vi.stubGlobal("confirm", vi.fn().mockReturnValue(false)); });
describe("legal policy unsaved changes", () => {
  it("preserves edits when changing policies is cancelled", async () => {
    render(<LegalDocumentsPanel />);
    const editor = await screen.findByLabelText("Policy content");
    fireEvent.change(editor, { target: { value: "<p>Draft text</p>" } });
    fireEvent.click(screen.getByRole("button", { name: /Terms policy/ }));
    expect(window.confirm).toHaveBeenCalledWith("Discard unsaved policy changes?");
    expect(editor).toHaveValue("<p>Draft text</p>");
    vi.mocked(window.confirm).mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: /Terms policy/ }));
    expect((editor as HTMLTextAreaElement).value).toContain("Saved text");
  });
  it("blocks link navigation while edited content would be lost", async () => {
    render(<LegalDocumentsPanel />);
    fireEvent.change(await screen.findByLabelText("Policy content"), { target: { value: "<p>Draft</p>" } });
    const link = document.createElement("a"); link.href = "/admin_recruiter/settings"; document.body.append(link);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true }); link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true); link.remove();
  });
});
