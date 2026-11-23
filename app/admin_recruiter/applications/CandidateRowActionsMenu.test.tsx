// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CandidateRowActionsMenu } from "./CandidateRowActionsMenu";
vi.mock("@/lib/admin/hooks/use-staff-module-access", () => ({ useModulePermission: () => ({ canEdit: true, canDelete: true }) }));
vi.mock("./MatchAnalyzeButton", () => ({ MatchAnalyzeMenuItems: () => null }));
afterEach(cleanup);
describe("candidate row more actions", () => {
  it("opens populated actions and invokes the selected action", () => {
    const anchor = document.createElement("button");
    document.body.appendChild(anchor);
    const remove = vi.fn();
    render(<CandidateRowActionsMenu anchor={anchor} onClose={vi.fn()} onAnalyze={vi.fn()} onUpdateResume={vi.fn()} onArchive={vi.fn()} onUnarchive={vi.fn()} onMessage={vi.fn()} onCall={vi.fn()} onSetupInterview={vi.fn()} onViewStatusHistory={vi.fn()} onDeleteCandidate={remove} onMarkAsHired={vi.fn()} />);
    fireEvent.click(screen.getByRole("menuitem", { name: "More Action" }));
    expect(screen.getByRole("menuitem", { name: "Message", exact: true })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Status history" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: /delete/i }));
    expect(remove).toHaveBeenCalledOnce();
    anchor.remove();
  });
});
