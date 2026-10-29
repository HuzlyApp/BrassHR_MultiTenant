/** @vitest-environment happy-dom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StaffAccessRecord } from "@/lib/admin/staff-access-cache";
import { StaffAccessSeed, useStaffModuleAccess } from "@/lib/admin/hooks/use-staff-module-access";

const seed: StaffAccessRecord = {
  tenantId: "tenant-a",
  godAdmin: false,
  grants: [{ key: "dashboard", canView: true, canEdit: true, canDelete: true }],
  viewKeys: ["dashboard", "mail"],
};

function Probe() {
  const access = useStaffModuleAccess();
  return <p>{access.loading ? "loading" : access.viewKeys.join(",")}</p>;
}

function wrap(initialAccess: StaffAccessRecord | null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <StaffAccessSeed initialAccess={initialAccess}>{children}</StaffAccessSeed>
      </QueryClientProvider>
    );
  };
}

describe("StaffAccessSeed", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders seeded view keys without calling /api/admin/access", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<Probe />, { wrapper: wrap(seed) });

    expect(screen.getByText("dashboard,mail")).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("does not show a forbidden module while access is still empty", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    render(<Probe />, { wrapper: wrap(null) });
    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(screen.queryByText(/mail/)).not.toBeInTheDocument();
  });
});
