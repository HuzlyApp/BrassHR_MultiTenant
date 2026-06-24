// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import FirmaIntegrationPanel from "@/app/admin_recruiter/account/components/FirmaIntegrationPanel";

vi.mock("@/app/admin_recruiter/hooks/useAccountData", () => ({
  useAccountData: () => ({
    organization: { id: "tenant-a", name: "New Co" },
    loading: false,
    error: null,
  }),
}));

describe("FirmaIntegrationPanel", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("shows global fallback source when tenant workspace is null", async () => {
    global.fetch = vi.fn(async () =>
      Response.json({
        firma_workspace_id: null,
        effective_workspace_id: "workspace_global_test",
        env_fallback_workspace_id: "workspace_global_test",
        source: "env",
      })
    ) as typeof fetch;

    render(<FirmaIntegrationPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Effective workspace:/)).toBeInTheDocument();
    });

    expect(screen.getByText("workspace_global_test")).toBeInTheDocument();
    expect(screen.getByText(/Server environment fallback/)).toBeInTheDocument();
    expect(screen.queryByText(/No Firma workspace is configured/)).not.toBeInTheDocument();
  });

  it("warns when neither tenant workspace nor env fallback is configured", async () => {
    global.fetch = vi.fn(async () =>
      Response.json({
        firma_workspace_id: null,
        effective_workspace_id: null,
        env_fallback_workspace_id: null,
        source: null,
      })
    ) as typeof fetch;

    render(<FirmaIntegrationPanel />);

    await waitFor(() => {
      expect(screen.getByText(/No Firma workspace is configured/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Not configured/)).toBeInTheDocument();
    expect(screen.getByText(/None/)).toBeInTheDocument();
  });
});
