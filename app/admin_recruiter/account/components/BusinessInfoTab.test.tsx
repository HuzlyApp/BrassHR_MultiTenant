// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import BusinessInfoTab from "./BusinessInfoTab";
const account = vi.hoisted(() => ({ organization: { id: "tenant", name: "Company", website: "https://example.com" }, settings: {}, checklist: {}, user: { id: "user" }, loading: false }));
vi.mock("@/app/admin_recruiter/hooks/useAccountData", () => ({ useAccountData: () => account }));
vi.mock("./CompanyAccountSummaryCard", () => ({ default: () => null }));
vi.mock("./FirmaIntegrationPanel", () => ({ default: () => null }));
vi.mock("./AccountTenantHeader", () => ({ default: () => null }));
vi.mock("@/lib/supabase-browser", () => ({ supabaseBrowser: { from: () => {
  const query = { select: () => query, eq: () => query, order: () => query, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve) };
  return query;
} } }));
describe("company website feedback", () => {
  it("shows invalid URL feedback on blur before submitting", () => {
    render(<BusinessInfoTab />);
    const website = screen.getByLabelText(/Website/);
    fireEvent.change(website, { target: { value: "not-a-url" } });
    fireEvent.blur(website);
    expect(screen.getByText("Enter a valid website URL.")).toBeInTheDocument();
    expect(website).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(website, { target: { value: "https://example.com" } });
    fireEvent.blur(website);
    expect(screen.queryByText("Enter a valid website URL.")).toBeNull();
  });
});
