// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminRecruiterHeader } from "./AdminRecruiterHeader";
vi.mock("next/navigation", () => ({ usePathname: () => "/admin_recruiter/dashboard", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/app/admin_recruiter/hooks/useAccountData", () => ({ useAccountData: () => ({ user: null, profile: null, organization: null, loading: true }) }));
vi.mock("@/app/components/tenant/TenantBrandingContext", () => ({ useTenantBranding: () => ({}) }));
vi.mock("./GodAdminTenantSwitcher", () => ({ default: () => null }));
vi.mock("@/lib/supabase-browser", () => ({ supabaseBrowser: {} }));
vi.mock("@/lib/admin/hooks/use-admin-header-data", () => ({ ADMIN_HEADER_DATA_QUERY_KEY: ["header"], useAdminHeaderData: () => ({ notifications: [], unreadNotifications: 0, isLoading: true }) }));
vi.mock("@/lib/messaging/hooks/use-staff-conversations", () => ({ useStaffConversations: () => ({ conversations: [], unreadMessages: 0, isLoading: true }) }));
vi.mock("@/lib/messaging/hooks/use-mark-conversation-read", () => ({ useMarkConversationRead: () => ({}) }));
vi.mock("@/lib/messaging/useApplicantConversationsRealtime", () => ({ useApplicantConversationsRealtime: () => undefined }));
describe("shared recruiter header loading", () => {
  it("shows a skeleton without a fabricated name, role or avatar", () => {
    render(<QueryClientProvider client={new QueryClient()}><AdminRecruiterHeader /></QueryClientProvider>);
    expect(screen.getByRole("status", { name: "Loading profile" })).toBeInTheDocument();
    expect(screen.queryByText("Loading...")).toBeNull();
    expect(screen.queryByText("Account Owner")).toBeNull();
    expect(screen.queryByText("A")).toBeNull();
  });
});
