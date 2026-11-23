// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TemplateCard } from "./RecruiterTemplateCards";
import type { RecruiterTemplateListItem } from "@/lib/recruiter-templates/types";
describe("archived document template actions", () => {
  it("offers deletion for archived templates", () => {
    const action = vi.fn();
    const template = { id: "template-a", name: "Archived template", status: "archived", category: "offer_letter", updated_at: "2026-11-24T00:00:00Z" } as RecruiterTemplateListItem;
    render(<TemplateCard template={template} onAction={action} />);
    fireEvent.click(screen.getByRole("button", { name: "Template actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete", exact: true }));
    expect(action).toHaveBeenCalledWith("delete");
  });
});
