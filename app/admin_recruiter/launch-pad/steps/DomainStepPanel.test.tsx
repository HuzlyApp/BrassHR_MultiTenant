// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/admin_recruiter/hooks/useAccountData", () => ({ useAccountData: () => ({ organization: { id: "tenant-a", subdomain: "test-5" }, refresh: mocks.refresh }) }));
import { DomainStepPanel } from "./DomainStepPanel";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.refresh.mockResolvedValue(undefined);
});
const renderPanel = () => {
  const onComplete = vi.fn();
  render(<DomainStepPanel onBack={vi.fn()} onSkip={vi.fn()} onComplete={onComplete} />);
  return onComplete;
};

describe("domain settings and handoff", () => {
  it("explains the development tenant link before saving", async () => {
    mocks.fetch.mockResolvedValueOnce(Response.json({ rootDomain: "brasshr.com", usesTenantQuery: true, workspaceUrl: "https://brasshr-devmode.vercel.app/admin_recruiter/home?tenant=zippycorp" }));
    renderPanel();
    expect(await screen.findByText(/This deployment uses tenant links:/)).toHaveTextContent("?tenant=zippycorp");
    expect(screen.getByText(/no custom domain is connected here/)).toBeInTheDocument();
  });
  it("shows the server failure and allows loading settings again", async () => {
    mocks.fetch.mockResolvedValueOnce(Response.json({ error: "Forbidden", detail: "Insufficient permission" }, { status: 403 }));
    mocks.fetch.mockResolvedValueOnce(Response.json({ rootDomain: "brasshr.test" }));
    renderPanel();
    expect(await screen.findByRole("alert")).toHaveTextContent("Insufficient permission");
    expect(screen.getByText("Domain unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save & Continue" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry domain settings" }));
    expect(await screen.findByText(".brasshr.test")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save & Continue" })).toBeEnabled();
  });

  it("passes the saved tenant URL to the modal after a successful save", async () => {
    mocks.fetch.mockResolvedValueOnce(Response.json({ rootDomain: "brasshr.test" }));
    mocks.fetch.mockResolvedValueOnce(Response.json({ workspaceUrl: "https://test-5.brasshr.test/admin_recruiter/home" }));
    const onComplete = renderPanel();
    await screen.findByText(".brasshr.test");
    fireEvent.click(screen.getByRole("button", { name: "Save & Continue" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith("https://test-5.brasshr.test/admin_recruiter/home"));
    expect(JSON.parse(mocks.fetch.mock.calls[1][1].body)).toEqual({ subdomain: "test-5" });
  });

  it("does not open a handoff when the domain could not be saved", async () => {
    mocks.fetch.mockResolvedValueOnce(Response.json({ rootDomain: "brasshr.test" }));
    mocks.fetch.mockResolvedValueOnce(Response.json({ error: "That subdomain is already taken." }, { status: 409 }));
    const onComplete = renderPanel();
    await screen.findByText(".brasshr.test");
    fireEvent.click(screen.getByRole("button", { name: "Save & Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That subdomain is already taken.");
    expect(onComplete).not.toHaveBeenCalled();
  });
});
