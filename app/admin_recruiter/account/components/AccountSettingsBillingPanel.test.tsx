// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AccountSettingsBillingPanel from "./AccountSettingsBillingPanel";
vi.mock("@/app/admin_recruiter/hooks/useAccountData", () => ({ useAccountData: () => ({ user: null, profile: null, organization: { plan: "Professional", name: "Company" }, loading: false }) }));
vi.mock("@/app/components/BrandedSvgIcon", () => ({ default: () => null }));
describe("billing subscription navigation", () => {
  it("switches to subscription details and back to billing", () => {
    render(<AccountSettingsBillingPanel />);
    expect(screen.getByText("Billing Center")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Subscription" }));
    expect(screen.getByText("My Subscription")).toBeInTheDocument();
    expect(screen.getByText("Professional")).toBeInTheDocument();
    expect(screen.getByText("Billing cycle")).toBeInTheDocument();
    expect(screen.getByText("Seats")).toBeInTheDocument();
    expect(screen.getAllByText("Not configured")).toHaveLength(2);
    expect(screen.queryByText("Billing Center")).toBeNull();
    expect(screen.getByRole("link", { name: "Manage Subscription" })).toHaveAttribute("href", "/admin_recruiter/help-support");
    fireEvent.click(screen.getByRole("button", { name: "Billing" }));
    expect(screen.getByText("Billing Center")).toBeInTheDocument();
  });
});
