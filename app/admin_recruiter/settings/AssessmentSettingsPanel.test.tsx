// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AssessmentSettingsPanel from "./AssessmentSettingsPanel";
import { createDefaultSkillAssessmentCatalog } from "@/lib/skill-assessment/defaults";
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("./AssessmentPreviewModal", () => ({ default: () => null }));
beforeEach(() => {
  mocks.fetch.mockReset().mockResolvedValue({ ok: true, json: async () => ({ canManage: true, settings: { draft: createDefaultSkillAssessmentCatalog() }, professions: [] }) });
  vi.stubGlobal("fetch", mocks.fetch);
});
describe("passing score editing", () => {
  it("keeps a negative draft visible and blocks saving until corrected or clamped", async () => {
    const user = userEvent.setup();
    render(<AssessmentSettingsPanel />);
    const input = await screen.findByLabelText(/Passing score/);
    await user.clear(input);
    await user.type(input, "-5");
    expect(input).toHaveValue("-5");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Save Draft" })).toBeDisabled();
    fireEvent.blur(input);
    expect(input).toHaveValue("0");
    expect(screen.getByRole("status")).toHaveTextContent("adjusted to 0%");
    expect(screen.getByRole("button", { name: "Save Draft" })).toBeEnabled();
  });
  it("clears an invalid score draft when Cancel restores saved settings", async () => {
    render(<AssessmentSettingsPanel />);
    const input = await screen.findByLabelText(/Passing score/);
    const savedValue = (input as HTMLInputElement).value;
    fireEvent.change(input, { target: { value: "invalid" } });
    expect(screen.getByRole("button", { name: "Save Draft" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(input).toHaveValue(savedValue);
    expect(screen.getByRole("button", { name: "Save Draft" })).toBeEnabled();
  });

  it.each([["150", "100"], ["05", "5"]])("normalizes %s to %s on blur", async (raw, expected) => {
    render(<AssessmentSettingsPanel />);
    const input = await screen.findByLabelText(/Passing score/);
    fireEvent.change(input, { target: { value: raw } });
    fireEvent.blur(input);
    expect(input).toHaveValue(expected);
    expect(screen.getByRole("button", { name: "Publish Changes" })).toBeEnabled();
  });
});
