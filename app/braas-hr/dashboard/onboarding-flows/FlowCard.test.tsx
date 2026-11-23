// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FlowCard } from "./page";
const flow = { id: "flow-a", name: "Nursing W2", status: "published" as const, libraryId: "folder-a", templateId: null, createdAsBlank: true, createdAt: "2026-11-20", updatedAt: "2026-11-20" };
describe("workflow card actions", () => {
  it("offers Duplicate and Unpublish on a published flow", () => {
    const duplicate = vi.fn(), unpublish = vi.fn();
    render(<FlowCard flow={flow} builderHref="/builder" viewHref="/view" onDelete={() => {}} onDuplicate={duplicate} onUnpublish={unpublish} />);
    fireEvent.click(screen.getByRole("button", { name: "More actions for Nursing W2" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));
    expect(duplicate).toHaveBeenCalledWith(flow);
    fireEvent.click(screen.getByRole("button", { name: "More actions for Nursing W2" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Unpublish" }));
    expect(unpublish).toHaveBeenCalledWith(flow);
  });
  it("does not offer Unpublish for an unpublished flow and disables actions while busy", () => {
    render(<FlowCard flow={{ ...flow, status: "unpublished" }} builderHref="/builder" viewHref="/view" deleting onDelete={() => {}} onDuplicate={() => {}} onUnpublish={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "More actions for Nursing W2" }));
    expect(screen.queryByRole("menuitem", { name: "Unpublish" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toBeDisabled();
  });
});
