// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ApplicantPortalShell } from "./ApplicantPortalShell";

const route = vi.hoisted(() => ({ pathname: "/application/candidate/jobs" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/app/components/tenant/TenantBrandingContext", () => ({ useTenantBranding: () => ({}) }));
vi.mock("@/lib/tenant/tenant-branding", () => ({ brandingToCssVars: () => ({}) }));
vi.mock("./ApplicantPortalHeader", () => ({ ApplicantPortalHeader: ({ onSidebarToggle }: { onSidebarToggle: () => void }) => <button onClick={onSidebarToggle}>Toggle sidebar</button> }));
vi.mock("./ApplicantPortalSidebar", () => ({
  WORKER_SIDEBAR_COLLAPSED_WIDTH: 80, WORKER_SIDEBAR_EXPANDED_WIDTH: 272,
  WORKER_SIDEBAR_COLLAPSED_WIDTH_NARROW: 64, WORKER_SIDEBAR_COLLAPSED_WIDTH_MOBILE: 48,
  ApplicantPortalSidebar: ({ collapsed }: { collapsed: boolean }) => <aside aria-label={collapsed ? "Collapsed" : "Expanded"} />,
}));

beforeEach(() => {
  localStorage.clear();
  route.pathname = "/application/candidate/jobs";
  window.scrollTo = vi.fn();
});

it("opens candidate navigation independently of worker preferences", () => {
  localStorage.setItem("workerPortalSidebarCollapsed", "true");
  render(<ApplicantPortalShell session={null}><p>Jobs</p></ApplicantPortalShell>);
  expect(screen.getByRole("complementary", { name: "Expanded" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Toggle sidebar" }));
  expect(screen.getByRole("complementary", { name: "Collapsed" })).toBeInTheDocument();
  expect(localStorage.getItem("candidatePortalSidebarCollapsed")).toBe("true");
});

it("restores the candidate's collapsed navigation preference", () => {
  localStorage.setItem("candidatePortalSidebarCollapsed", "true");
  render(<ApplicantPortalShell session={null}><p>Jobs</p></ApplicantPortalShell>);
  expect(screen.getByRole("complementary", { name: "Collapsed" })).toBeInTheDocument();
});

it("keeps the worker navigation collapsed by default", () => {
  route.pathname = "/application/home";
  render(<ApplicantPortalShell session={null}><p>Worker home</p></ApplicantPortalShell>);
  expect(screen.getByRole("complementary", { name: "Collapsed" })).toBeInTheDocument();
});
