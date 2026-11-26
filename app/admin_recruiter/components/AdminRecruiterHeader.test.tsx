// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminRecruiterHeader } from "./AdminRecruiterHeader";
const state = vi.hoisted(() => ({
  push: vi.fn(),
  account: { user: null as { id: string } | null, profile: null as { first_name: string; role: string } | null, organization: null, loading: true },
  header: { userId: null as string | null, roleLabel: null as string | null, notifications: [], unreadNotifications: 0, isLoading: true },
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/admin_recruiter/dashboard", useRouter: () => ({ push: state.push }) }));
vi.mock("@/app/admin_recruiter/hooks/useAccountData", () => ({ useAccountData: () => state.account }));
vi.mock("@/app/components/tenant/TenantBrandingContext", () => ({ useTenantBranding: () => ({}) }));
vi.mock("./GodAdminTenantSwitcher", () => ({ default: () => null }));
vi.mock("@/lib/supabase-browser", () => ({ supabaseBrowser: {} }));
vi.mock("@/lib/admin/hooks/use-admin-header-data", () => ({ ADMIN_HEADER_DATA_QUERY_KEY: ["header"], useAdminHeaderData: () => state.header }));
vi.mock("@/lib/messaging/hooks/use-staff-conversations", () => ({ useStaffConversations: () => ({ conversations: [], unreadMessages: 0, isLoading: true }) }));
vi.mock("@/lib/messaging/hooks/use-mark-conversation-read", () => ({ useMarkConversationRead: () => ({}) }));
vi.mock("@/lib/messaging/useApplicantConversationsRealtime", () => ({ useApplicantConversationsRealtime: () => undefined }));
describe("shared recruiter header loading", () => {
  beforeEach(() => {
    Object.assign(state.account, { user: null, profile: null, loading: true });
    Object.assign(state.header, { userId: null, roleLabel: null, isLoading: true });
  });
  it("displays the tenant role instead of the home account's Admin label", () => {
    Object.assign(state.account, { user: { id: "member" }, profile: { first_name: "Member", role: "admin" }, loading: false });
    Object.assign(state.header, { userId: "member", roleLabel: "Manager", isLoading: false });
    render(<QueryClientProvider client={new QueryClient()}><AdminRecruiterHeader /></QueryClientProvider>);
    expect(screen.getByText("Manager")).toBeInTheDocument(); expect(screen.queryByText("Admin")).toBeNull();
  });
  it("does not display a role cached for another account", () => {
    Object.assign(state.account, { user: { id: "hr" }, profile: { first_name: "Member", role: "hr" }, loading: false });
    Object.assign(state.header, { userId: "admin", roleLabel: "Admin", isLoading: false });
    render(<QueryClientProvider client={new QueryClient()}><AdminRecruiterHeader /></QueryClientProvider>);
    expect(screen.queryByText("Admin")).toBeNull(); expect(screen.getByText("Loading role…")).toBeInTheDocument();
  });
  it("shows a skeleton without a fabricated name, role or avatar", () => {
    render(<QueryClientProvider client={new QueryClient()}><AdminRecruiterHeader /></QueryClientProvider>);
    expect(screen.getByRole("status", { name: "Loading profile" })).toBeInTheDocument();
    expect(screen.queryByText("Loading...")).toBeNull();
    expect(screen.queryByText("Account Owner")).toBeNull();
    expect(screen.queryByText("A")).toBeNull();
  });
});

it("does not flash Staff while the current user's tenant role is loading", () => {
  Object.assign(state.account, { user: { id: "admin" }, profile: { first_name: "Admin", role: "admin" }, loading: false });
  Object.assign(state.header, { userId: null, roleLabel: null, isLoading: true });
  render(<QueryClientProvider client={new QueryClient()}><AdminRecruiterHeader /></QueryClientProvider>);
  expect(screen.queryByText("Staff")).not.toBeInTheDocument();
  expect(screen.getByText("Loading role…")).toBeInTheDocument();
});


it("opens the message conversation from an already-read notification", () => {
  state.push.mockClear();
  Object.assign(state.header, { isLoading: false, notifications: [{
    id: "message-alert", title: "New applicant message", is_read: true,
    link: "/admin_recruiter/messages?workerId=worker",
  }] });
  const client = new QueryClient();
  client.setQueryData(["header"], { notifications: state.header.notifications });
  render(<QueryClientProvider client={client}><AdminRecruiterHeader /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
  fireEvent.click(screen.getByRole("button", { name: "New applicant message" }));
  expect(state.push).toHaveBeenCalledWith("/admin_recruiter/messages?workerId=worker");
  expect(screen.queryByRole("dialog", { name: "Notifications" })).not.toBeInTheDocument();
  Object.assign(state.header, { notifications: [] });
});
