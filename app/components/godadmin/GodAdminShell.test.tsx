/** @vitest-environment happy-dom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const replace = vi.hoisted(() => vi.fn());
const router = { replace };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/supabase-browser", () => ({ supabaseBrowser: { auth: { getSession: async () => ({ data: { session: { access_token: "staff-token" } } }) } } }));
vi.mock("@/app/components/godadmin/GodAdminSidebar", () => ({ default: () => null }));
import GodAdminShell from "./GodAdminShell";
describe("platform access denied", () => {
  it("keeps signed-in staff on an explicit denial page with a route back", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ godAdmin: false })));
    const view = render(<GodAdminShell>Platform secrets</GodAdminShell>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Access denied");
    expect(screen.queryByText("Platform secrets")).toBeNull();
    expect(screen.getByRole("link", { name: "Return to your dashboard" })).toHaveAttribute("href", "/admin_recruiter/dashboard");
    expect(replace).not.toHaveBeenCalled();
    view.unmount();
    vi.unstubAllGlobals();
  });
});
