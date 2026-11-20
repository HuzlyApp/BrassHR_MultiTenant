// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LAUNCH_PAD_STORAGE_KEY } from "./constants";

const nav = vi.hoisted(() => ({ search: "step=domain", push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: nav.push }), useSearchParams: () => new URLSearchParams(nav.search) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/app/admin_recruiter/hooks/useAccountData", () => ({ useAccountData: () => ({ organization: { id: "tenant-a" } }) }));
vi.mock("./steps/DomainStepPanel", () => ({ DomainStepPanel: ({ onComplete }: { onComplete: () => void }) => <button onClick={onComplete}>Confirm domain</button> }));
vi.mock("./steps/BrandingStepPanel", () => ({ BrandingStepPanel: () => null }));
vi.mock("./steps/InviteStepPanel", () => ({ InviteStepPanel: () => null }));
vi.mock("./steps/LogoStepPanel", () => ({ LogoStepPanel: () => null }));
vi.mock("./steps/OrgDetailsStepPanel", () => ({ OrgDetailsStepPanel: () => null }));
vi.mock("./steps/PreviewStepPanel", () => ({ PreviewStepPanel: () => null }));
import LaunchPadPage from "./page";

beforeEach(() => {
  localStorage.clear();
  nav.search = "step=domain";
  nav.push.mockImplementation(() => { nav.search = ""; });
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ workspaceUrl: "https://chosen.brasshr.test/admin_recruiter/home" })));
});

describe("Launch Pad finish handoff", () => {
  it("opens the subdomain modal after the last step is confirmed", async () => {
    localStorage.setItem(`${LAUNCH_PAD_STORAGE_KEY}:tenant-a`, JSON.stringify({ logo: true, branding: true, domain: false, preview: true, invite: true, organization: true }));
    render(<LaunchPadPage />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm domain" }));
    expect(await screen.findByRole("link", { name: "Open my workspace" })).toHaveAttribute("href", "https://chosen.brasshr.test/admin_recruiter/home");
  });
  it("keeps the handoff closed while other steps remain unfinished", () => {
    render(<LaunchPadPage />);
    fireEvent.click(screen.getByRole("button", { name: "Confirm domain" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
