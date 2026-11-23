// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MailComposePanel } from "./MailComposePanel";
import { invalidateStaffDetailCache } from "@/lib/admin/staff-detail-fetch-cache";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), noop: vi.fn(), session: vi.fn() }));
vi.mock("@/lib/supabase-browser", () => ({ supabaseBrowser: { auth: { getSession: mocks.session } } }));
vi.mock("./useCandidateEmailTemplates", () => ({ useCandidateEmailTemplates: () => ({ templates: [], loadingTemplates: false, templatesError: null, selectedTemplateKey: "", setSelectedTemplateKey: mocks.noop, bodyHtml: null, setBodyHtml: mocks.noop, previewLoading: false, previewError: null, applyTemplate: mocks.noop, clearTemplate: mocks.noop, resetComposeTemplateState: mocks.noop }) }));
vi.mock("./useMailDraftSave", () => ({ useMailDraftSave: () => ({ draftSaving: false, draftSavedAt: null, draftError: null, saveDraft: mocks.noop, queueAutoSave: mocks.noop, flushAutoSave: mocks.noop }) }));
vi.mock("./MailEmailTemplateSelect", () => ({ MailEmailTemplateSelect: () => null }));
vi.mock("./MailComposeCandidateDropdown", () => ({ MailComposeCandidateDropdown: (props: { applicantOptions: Array<{ value: string; label: string }>; loading: boolean }) => props.loading ? <span>Loading candidates</span> : <select aria-label="Candidate"><option value="">Pick a candidate</option>{props.applicantOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> }));
vi.mock("./CommunicationThreadParts", () => ({ EmailComposeForm: (props: { leadingRow: React.ReactNode; subject: string; onSubjectChange: (value: string) => void }) => <div>{props.leadingRow}<input aria-label="Subject" value={props.subject} onChange={event => props.onSubjectChange(event.target.value)} /></div> }));
beforeEach(() => { vi.clearAllMocks(); invalidateStaffDetailCache(); mocks.session.mockImplementation(() => new Promise(() => {})); mocks.fetch.mockImplementation(async (url: string) => Response.json({ workers: url.includes("/api/workers?") ? [{ id: "candidate-a", first_name: "Jane", last_name: "Doe", email: "jane@example.com" }] : [] })); vi.stubGlobal("fetch", mocks.fetch); });
describe("mail candidate loading", () => {
  it("loads cookie-authenticated choices once and remains stable while composing", async () => {
    const { rerender } = render(<MailComposePanel />);
    expect(await screen.findByRole("option", { name: "Jane Doe" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Hello" } });
    rerender(<MailComposePanel />);
    await waitFor(() => expect(screen.queryByText("Loading candidates")).not.toBeInTheDocument());
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.fetch).toHaveBeenCalledWith(expect.stringContaining("employment-workers"), expect.objectContaining({ credentials: "include" }));
  });
  it("shows recoverable failure feedback and retries loading choices", async () => {
    mocks.fetch.mockResolvedValueOnce(Response.json({ error: "Could not load candidates" }, { status: 503 }));
    render(<MailComposePanel />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load candidates");
    fireEvent.click(screen.getByRole("button", { name: "Retry candidates" }));
    expect(await screen.findByRole("option", { name: "Jane Doe" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
