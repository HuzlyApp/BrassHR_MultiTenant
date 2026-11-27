// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CandidateDetailPayRateField from "./CandidateDetailPayRateField";
vi.mock("@/app/admin_recruiter/hooks/useCompactViewport", () => ({ useCompactViewport: () => false }));
vi.mock("./BrandedEditIcon", () => ({ default: () => null }));
vi.mock("./CandidateDetailFieldEditModal", () => ({ default: () => null }));

describe("agreed pay rate editor", () => {
  it.each(["20-30", "-5", "25.999", "abc"])("never saves a rewritten version of %s", async (raw) => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<CandidateDetailPayRateField amount="25" period="Hourly" isMissing={false} onSave={save} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Pay Rate" }));
    const input = screen.getByLabelText("Pay rate amount");
    fireEvent.change(input, { target: { value: raw } });
    expect(input).toHaveValue(raw);
    fireEvent.click(screen.getByRole("button", { name: "Save", exact: true }));
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByText(/single positive pay rate/)).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "25.50" } });
    expect(screen.queryByText(/single positive pay rate/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save", exact: true }));
    await waitFor(() => expect(save).toHaveBeenCalledWith({ amount: "25.50", period: "Hourly" }));
  });
});
