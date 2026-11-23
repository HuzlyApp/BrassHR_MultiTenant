// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AddCustomProfessionModal from "./AddCustomProfessionModal";
describe("profession name limit", () => {
  it("displays the 80-character limit and current count", () => {
    render(<AddCustomProfessionModal open industryLabel="Healthcare" assessments={[{ id: "test", name: "Assessment" }]} onClose={vi.fn()} onCreate={vi.fn()} />);
    const input = screen.getByLabelText(/Position Name/);
    expect(input).toHaveAttribute("maxlength", "80");
    expect(screen.getByText("0/80 characters")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "Nursing" } });
    expect(screen.getByText("7/80 characters")).toBeInTheDocument();
  });
});
