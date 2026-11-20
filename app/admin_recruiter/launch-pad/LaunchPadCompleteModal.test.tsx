// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LaunchPadCompleteModal } from "./LaunchPadCompleteModal";
import { readLaunchPadProgress, markLaunchPadStepComplete } from "./progress";

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("Launch Pad completion", () => {
  it("displays the tenant query and opens the development workspace", async () => {
    const workspaceUrl = "https://brasshr-devmode.vercel.app/admin_recruiter/home?tenant=zippycorp";
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ workspaceUrl })));
    render(<LaunchPadCompleteModal open onOpenChange={vi.fn()} />);
    expect(await screen.findByRole("link", { name: "Open my workspace" })).toHaveAttribute("href", workspaceUrl);
    expect(screen.getByText("brasshr-devmode.vercel.app?tenant=zippycorp")).toBeInTheDocument();
  });
  it("shows the server-resolved subdomain and opens its admin workspace", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ workspaceUrl: "https://chosen.brasshr.test/admin_recruiter/home" })));
    render(<LaunchPadCompleteModal open onOpenChange={vi.fn()} />);
    expect(await screen.findByRole("link", { name: "Open my workspace" })).toHaveAttribute("href", "https://chosen.brasshr.test/admin_recruiter/home");
    expect(screen.getByText("chosen.brasshr.test")).toBeInTheDocument();
    expect(screen.getByText(/email and password you used at signup/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/admin/launch-pad/domain", expect.objectContaining({ method: "POST" }));
  });

  it("provides a retry instead of a broken link when the workspace cannot load", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Try later" }, { status: 500 })));
    render(<LaunchPadCompleteModal open onOpenChange={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Try later");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not show or fetch the handoff before completion", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<LaunchPadCompleteModal open={false} onOpenChange={vi.fn()} />);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps progress separate for each tenant and persists it across visits", () => {
    markLaunchPadStepComplete("tenant-a", "domain");
    expect(readLaunchPadProgress("tenant-a").domain).toBe(true);
    expect(readLaunchPadProgress("tenant-b").domain).toBe(false);
    expect(readLaunchPadProgress("tenant-b").branding).toBe(false);
  });
});
