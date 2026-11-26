// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
const state = vi.hoisted(() => ({
  params: new URLSearchParams(),
  authHeaders: vi.fn(async () => ({ Authorization: "Bearer token" })),
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => state.params }));
vi.mock("@/app/components/tenant/TenantBrandingContext", () => ({
  useTenantBranding: () => ({ companyName: "Clinic" }),
}));
vi.mock(
  "@/app/application/components/applicant-portal/ApplicantPortalProvider",
  () => ({
    useApplicantPortal: () => ({
      sessionReady: true,
      session: { applicant: { id: "worker", name: "Alex" } },
      authHeaders: state.authHeaders,
      messaging: { messages: [] },
    }),
  }),
);
vi.mock("@/app/admin_recruiter/messages/GroupStackedAvatars", () => ({
  default: () => null,
  SingleChatAvatar: () => null,
}));
vi.mock(
  "@/app/application/components/applicant-portal/ApplicantRecruiterChatConversation",
  () => ({
    ApplicantRecruiterChatConversation: () => <div>Recruiter conversation</div>,
  }),
);
vi.mock(
  "@/app/application/components/applicant-portal/ApplicantGroupChatTab",
  () => ({
    ApplicantGroupConversation: ({ groupId }: { groupId: string }) => (
      <div>Group conversation: {groupId}</div>
    ),
  }),
);
import { ApplicantChatClient } from "./ApplicantChatClient";

beforeEach(() => {
  state.params = new URLSearchParams();
  vi.unstubAllGlobals();
});

it("lets candidates read recruiter messages without requesting worker-only groups", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  state.params = new URLSearchParams("tab=group");
  render(<ApplicantChatClient directOnly />);
  expect(await screen.findByText("Recruiter conversation")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Group" }),
  ).not.toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

it("opens the group selected by the notification link", async () => {
  state.params = new URLSearchParams("tab=group&group=second");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        groups: [
          { id: "first", name: "First", members: [], memberCount: 0 },
          { id: "second", name: "Second", members: [], memberCount: 0 },
        ],
      }),
    })),
  );
  render(<ApplicantChatClient />);
  expect(
    await screen.findByText("Group conversation: second"),
  ).toBeInTheDocument();
});
