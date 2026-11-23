// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LAUNCH_PAD_STORAGE_KEY } from "./constants";

const nav = vi.hoisted(() => ({ search: "step=domain", push: vi.fn() }));
const tenantRecovery = vi.hoisted(() => ({ clear: vi.fn(), host: vi.fn(() => ({ subdomainLabel: null as string | null })) }));
vi.mock("@/lib/tenant/resolve-tenant-context", () => ({ clearOnboardingTenantSlugCookie: tenantRecovery.clear, resolveClientTenantHost: tenantRecovery.host }));
const server = vi.hoisted(() => ({ progress: { logo: false, branding: false, domain: false, preview: false, invite: false, organization: false }, interests: { keys: [] as string[], skipped: true, answeredAt: "2026-11-20T20:00:00Z" as string | null } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: nav.push }), useSearchParams: () => new URLSearchParams(nav.search) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/app/admin_recruiter/hooks/useAccountData", () => ({ useAccountData: () => ({ organization: { id: "tenant-a" } }) }));
vi.mock("./steps/DomainStepPanel", () => ({ DomainStepPanel: ({ onComplete, onSkip }: { onComplete: () => void; onSkip: () => void }) => <><button onClick={() => { server.progress.domain = true; onComplete(); }}>Confirm domain</button><button onClick={onSkip}>Skip for now</button></> }));
vi.mock("./steps/BrandingStepPanel", () => ({ BrandingStepPanel: ({ onComplete }: { onComplete: () => void }) => <button onClick={onComplete}>Confirm branding</button> }));
vi.mock("./steps/InviteStepPanel", () => ({ InviteStepPanel: () => null }));
vi.mock("./steps/LogoStepPanel", () => ({ LogoStepPanel: () => null }));
vi.mock("./steps/OrgDetailsStepPanel", () => ({ OrgDetailsStepPanel: () => null }));
vi.mock("./steps/PreviewStepPanel", () => ({ PreviewStepPanel: () => null }));
import LaunchPadPage from "./page";

beforeEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  nav.search = "step=domain";
  server.progress = { logo: false, branding: false, domain: false, preview: false, invite: false, organization: false };
  server.interests = { keys: [], skipped: true, answeredAt: "2026-11-20T20:00:00Z" };
  nav.push.mockReset();
  tenantRecovery.clear.mockReset();
  tenantRecovery.host.mockReturnValue({ subdomainLabel: null });
  nav.push.mockImplementation(() => { nav.search = ""; });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/interests")) {
      if (init?.method === "PUT") server.interests = { ...JSON.parse(String(init.body)), answeredAt: "2026-11-20T20:00:00Z" };
      return Response.json({ tenantId: "tenant-a", interests: server.interests });
    }
    if (url.endsWith("/progress")) {
      if (init?.method === "POST") {
        const { stepId } = JSON.parse(String(init.body)) as { stepId: keyof typeof server.progress };
        server.progress[stepId] = true;
      }
      return Response.json({ tenantId: "tenant-a", progress: server.progress });
    }
    return Response.json({ workspaceUrl: "https://chosen.brasshr.test/admin_recruiter/home" });
  }));
});

describe("Launch Pad finish handoff", () => {
  it("offers home-organization recovery for a stale workspace cookie on a shared host", async () => {
    vi.mocked(fetch).mockImplementation(async () => Response.json({ error: "Forbidden" }, { status: 403 }));
    const assign = vi.spyOn(window.location, "assign").mockImplementation(() => {});
    render(<LaunchPadPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Return to my organization" }));
    expect(tenantRecovery.clear).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledWith("/admin_recruiter/launch-pad");
    assign.mockRestore();
  });

  it("does not override an explicitly requested tenant after access denial", async () => {
    nav.search = "tenant=other-company";
    vi.mocked(fetch).mockImplementation(async () => Response.json({ error: "Forbidden" }, { status: 403 }));
    render(<LaunchPadPage />);
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "Return to my organization" })).not.toBeInTheDocument();
    expect(tenantRecovery.clear).not.toHaveBeenCalled();
  });

  it("does not override a branded workspace host after access denial", async () => {
    tenantRecovery.host.mockReturnValue({ subdomainLabel: "other-company" });
    vi.mocked(fetch).mockImplementation(async () => Response.json({ error: "Forbidden" }, { status: 403 }));
    render(<LaunchPadPage />);
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "Return to my organization" })).not.toBeInTheDocument();
  });
  it("shows signup interests before the checklist, including direct step links", async () => {
    server.interests = { keys: [], skipped: false, answeredAt: null };
    render(<LaunchPadPage />);
    expect(await screen.findByRole("heading", { name: "What brings you to brassHR" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm domain" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Time & Attendance" }));
    fireEvent.click(screen.getByRole("button", { name: "Save & Continue" }));
    expect(await screen.findByRole("heading", { name: "Launch Pad" })).toBeInTheDocument();
    expect(server.interests.keys).toEqual(["time_attendance"]);
    expect(server.progress).toEqual({ logo: false, branding: false, domain: false, preview: false, invite: false, organization: false });
  });
  it("opens the subdomain modal after the last step is confirmed", async () => {
    server.progress = { logo: true, branding: true, domain: false, preview: true, invite: true, organization: true };
    render(<LaunchPadPage />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Confirm domain" }));
    expect(await screen.findByRole("link", { name: "Open my workspace" })).toHaveAttribute("href", "https://chosen.brasshr.test/admin_recruiter/home");
  });
  it("saves step 3 without opening the modal or activating the domain", async () => {
    render(<LaunchPadPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Confirm domain" }));
    await waitFor(() => expect(nav.push).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith("/api/admin/launch-pad/domain", expect.anything());
    const progress = JSON.parse(localStorage.getItem(`${LAUNCH_PAD_STORAGE_KEY}:tenant-a`)!);
    expect(progress.domain).toBe(true);
    expect(progress.branding).toBe(false);
  });

  it("shows the final modal when a task other than domain is completed last", async () => {
    nav.search = "step=branding";
    server.progress = { logo: true, branding: false, domain: true, preview: true, invite: true, organization: true };
    render(<LaunchPadPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Confirm branding" }));
    expect(await screen.findByRole("link", { name: "Open my workspace" })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/admin/launch-pad/domain", expect.objectContaining({ method: "POST" }));
  });

  it("does not treat skipped tasks or old browser-only completion as complete", async () => {
    localStorage.setItem(`${LAUNCH_PAD_STORAGE_KEY}:tenant-a`, JSON.stringify({ logo: true, branding: true, domain: true, preview: true, invite: true, organization: true }));
    render(<LaunchPadPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Skip for now" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(server.progress.domain).toBe(false);
    expect(JSON.parse(localStorage.getItem(`${LAUNCH_PAD_STORAGE_KEY}:tenant-a`)!)).toEqual(server.progress);
  });

  it("keeps the task open and reports progress save failures", async () => {
    nav.search = "step=branding";
    render(<LaunchPadPage />);
    await screen.findByRole("button", { name: "Confirm branding" });
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ error: "Please retry" }, { status: 503 }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm branding" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Please retry");
    expect(nav.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
