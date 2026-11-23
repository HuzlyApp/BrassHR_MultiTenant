// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CandidateNotesPanel from "./CandidateNotesPanel";
const permissions = vi.hoisted(() => ({ canEdit: true, canDelete: true }));
vi.mock("@/lib/admin/hooks/use-staff-module-access", () => ({ useModulePermission: () => permissions }));
const note = { id: "note-a", body: "Original note", author_name: "Recruiter", created_at: "2026-11-20T00:00:00Z" };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); permissions.canEdit = true; permissions.canDelete = true; });
function setup() {
  const request = vi.fn(async (_url: unknown, init?: RequestInit) => ({ ok: true, json: async () => init?.method === "PATCH" ? { note: { id: note.id, body: "Edited note" } } : init?.method === "DELETE" ? { ok: true } : { notes: [note] } }));
  vi.stubGlobal("fetch", request);
  render(<CandidateNotesPanel workerId="worker-a" candidateName="Ana Cruz" />);
  return request;
}
describe("candidate note management", () => {
  it("edits an existing note without losing its author or creating a duplicate", async () => {
    const request = setup();
    fireEvent.click(await screen.findByRole("button", { name: "Edit note" }));
    fireEvent.change(screen.getByPlaceholderText("Add your notes here"), { target: { value: "Edited note" } });
    fireEvent.click(screen.getByRole("button", { name: "Save", exact: true }));
    await waitFor(() => expect(screen.queryByPlaceholderText("Add your notes here")).not.toBeInTheDocument());
    expect(screen.getByText("Edited note")).toBeInTheDocument();
    expect(screen.queryByText("Original note")).not.toBeInTheDocument();
    expect(screen.getByText("Recruiter")).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith("/api/admin/worker-notes", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ workerId: "worker-a", body: "Edited note", noteId: "note-a" }) }));
  });
  it("requires confirmation before deleting and removes a confirmed note", async () => {
    const request = setup();
    const confirm = vi.fn().mockReturnValue(false);
    vi.stubGlobal("confirm", confirm);
    window.confirm = confirm;
    fireEvent.click(await screen.findByRole("button", { name: "Delete note" }));
    expect(request).toHaveBeenCalledTimes(1);
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete note" }));
    await waitFor(() => expect(screen.queryByText("Original note")).not.toBeInTheDocument());
    expect(request).toHaveBeenCalledWith("/api/admin/worker-notes", expect.objectContaining({ method: "DELETE" }));
  });
  it("hides mutation controls for a read-only viewer", async () => {
    permissions.canEdit = false; permissions.canDelete = false;
    setup();
    await screen.findByText("Original note");
    expect(screen.queryByRole("button", { name: "Edit note" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete note" })).not.toBeInTheDocument();
  });
});
