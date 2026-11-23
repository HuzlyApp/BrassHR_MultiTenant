// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PersonalTab from "./PersonalTab";
const account = vi.hoisted(() => ({ user: { id: "staff", email: "test@example.com" }, profile: { first_name: "Test", last_name: "Person", role: "admin", job_title: "Admin", birthdate: "1990-01-01" }, loading: false }));
vi.mock("@/app/admin_recruiter/hooks/useAccountData", () => ({ useAccountData: () => account }));
vi.mock("./StaffProfilePhotoUpload", () => ({ StaffProfilePhotoUpload: () => null }));
vi.mock("./AccountOtpModal", () => ({ default: () => null }));
vi.mock("@/lib/mapbox/use-address-autocomplete", () => ({ useAddressAutocomplete: () => ({ suggestions: [], isOpen: false }) }));
vi.mock("@/lib/supabase-browser", () => ({ supabaseBrowser: { from: () => {
  const query = { select: () => query, eq: () => query, order: () => query, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve) };
  return query;
} } }));
beforeEach(() => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ departments: [] }) })); });
describe("personal profile form", () => {
  it("excludes inactive departments from personal profile choices", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ departments: [{ id: "active-a", name: "Nursing", isActive: true }, { id: "inactive-a", name: "Pay Rate: $58 - $60", isActive: false }] }) }));
    render(<PersonalTab />);
    expect(await screen.findByRole("option", { name: "Nursing" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Pay Rate: $58 - $60" })).not.toBeInTheDocument();
  });
  it("uses inline feedback consistently for all missing required fields", () => {
    const { container } = render(<PersonalTab />);
    for (const name of [/First Name/, /Last Name/, /Birthdate/, /Job Title/]) fireEvent.change(screen.getByLabelText(name), { target: { value: "" } });
    fireEvent.submit(container.querySelector("form")!);
    for (const message of ["First name is required.", "Last name is required.", "Birthdate is required.", "Job title is required."]) expect(screen.getByText(message)).toBeInTheDocument();
    expect(container.querySelector("form")).toHaveAttribute("novalidate");
  });
  it("lets staff cancel navigation with unsaved edits and clears the warning on Cancel", () => {
    render(<PersonalTab />);
    fireEvent.change(screen.getByLabelText("Preferred Name"), { target: { value: "Draft" } });
    const confirm = vi.fn().mockReturnValue(false);
    vi.stubGlobal("confirm", confirm);
    const link = document.createElement("a"); link.href = "/admin_recruiter/account/security"; document.body.append(link);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalledWith("Discard unsaved profile changes?");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    confirm.mockClear();
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(confirm).not.toHaveBeenCalled();
    link.remove();
  });
});
