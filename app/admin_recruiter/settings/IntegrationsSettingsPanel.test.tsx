// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import Panel from "./IntegrationsSettingsPanel";
const mocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("react-hot-toast", () => ({ default: mocks }));
vi.mock("./IntegrationsApiDocs", () => ({ default: () => null }));
vi.mock("./integration-icons", () => ({ IntegrationBrandIcon: () => null }));

describe("integration connection truthfulness", () => {
  it("does not show seeded providers as connected or offer a simulated connection", () => {
    render(<Panel />);
    expect(screen.getByText(/0 of \d+ connected/)).toBeInTheDocument();
    const quickbooks = screen.getByText("Quickbooks").closest("article")!;
    expect(within(quickbooks).getByRole("button", { name: "Not available yet" })).toBeDisabled();
    expect(screen.queryByText("Active")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage API access" })).toBeEnabled();
  });
  it("does not claim webhook settings were persisted when delivery is unavailable", () => {
    render(<Panel />);
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("have not been saved"));
    expect(mocks.success).not.toHaveBeenCalled();
  });
});
