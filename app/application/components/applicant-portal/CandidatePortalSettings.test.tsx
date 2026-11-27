// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { CandidateProfilePanel } from "./CandidateProfilePanel";
import { CandidateNotificationsClient } from "./CandidateNotificationsClient";
import { CandidateJobAlertsClient } from "./CandidateJobAlertsClient";
import { CandidateAccountPanel } from "./CandidateAccountPanel";

const mocks = vi.hoisted(() => ({ authHeaders: vi.fn(async () => ({ Authorization: "Bearer test" })), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("tenant=zipstaff"), useRouter: () => ({ push: mocks.push }) }));
vi.mock("./ApplicantPortalProvider", () => ({ useApplicantPortal: () => ({ sessionReady: true, authHeaders: mocks.authHeaders, setProfilePhotoUrl: vi.fn(), session: { applicant: { id: "candidate-1" } } }) }));
vi.mock("@/app/components/tenant/TenantBrandingContext", () => ({ useTenantBranding: () => ({ slug: "zipstaff", companyName: "ZipStaff", primaryHex: "#bc8b41", accentHex: "#bc8b41" }) }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn() } }));
vi.mock("@/lib/supabase-browser", () => ({ supabaseBrowser: {} }));
vi.mock("@/lib/auth/authenticator-mfa", () => ({ listAuthenticatorFactors: vi.fn(async () => []), authenticatorIssuer: vi.fn() }));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

it("preserves additional profile fields when saving the compact personal form", async () => {
  const profile = { firstName: "CJ", lastName: "Clark", email: "cj@example.com", address1: "235 Maryland Street", city: "Austin", state: "TX", zip: "78745", preferredName: "CJ", jobTitle: "Nurse", bio: "My bio" };
  const fetchMock = vi.fn(async () => Response.json({ profile }));
  vi.stubGlobal("fetch", fetchMock);
  render(<CandidateProfilePanel />);
  await waitFor(() => expect(screen.getByLabelText("First Name")).toHaveValue("CJ"));
  fireEvent.change(screen.getByLabelText("First Name"), { target: { value: "Carlton" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByLabelText("First Name")).toHaveValue("CJ");
  fireEvent.change(screen.getByLabelText("First Name"), { target: { value: "Carlton" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  const options = (fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1];
  expect(JSON.parse(options.body as string)).toMatchObject({ firstName: "Carlton", preferredName: "CJ", jobTitle: "Nurse", city: "Austin", bio: "My bio" });
});

it("shows notification mutation failures without navigating away", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ notifications: [{ id: "n1", title: "Application update", body: "Under review", is_read: false, link: "/application/candidate/applications", sent_at: null }] })).mockResolvedValue(Response.json({ error: "Please try again" }, { status: 500 }));
  vi.stubGlobal("fetch", fetchMock);
  render(<CandidateNotificationsClient />);
  await screen.findByText("Application update");
  fireEvent.click(screen.getByRole("button", { name: "View" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Please try again");
  expect(mocks.push).not.toHaveBeenCalled();
  expect(screen.getByText("Application update")).toBeInTheDocument();
});

it("saves account preferences from the separate preferences card", async () => {
  const fetchMock = vi.fn(async () => Response.json({ profile: { email: "cj@example.com" } }));
  vi.stubGlobal("fetch", fetchMock);
  render(<CandidateAccountPanel />);
  await screen.findByDisplayValue("cj@example.com");
  fireEvent.change(screen.getByLabelText("Date Format"), { target: { value: "DD/MM/YYYY" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Preferences" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  const options = (fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1];
  expect(JSON.parse(options.body as string)).toMatchObject({ section: "preferences", dateFormat: "DD/MM/YYYY" });
});

it("creates and edits saved job alert filters without adding a duplicate", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ jobs: [{ public_job_token: "nurse-token", public_title: "Registered Nurse", location: "Austin", published_at: null }] })));
  render(<CandidateJobAlertsClient />);
  fireEvent.click(screen.getByRole("button", { name: "Create New Alert" }));
  fireEvent.change(screen.getByLabelText("Alert name"), { target: { value: "Nurse" } });
  fireEvent.click(screen.getByRole("button", { name: "Save alert" }));
  await screen.findByText("Registered Nurse");
  expect(screen.getByRole("link", { name: "Apply" })).toHaveAttribute("href", "/application/candidate/jobs?job=nurse-token&tenant=zipstaff");
  fireEvent.click(screen.getByRole("button", { name: "Edit Filters" }));
  fireEvent.change(screen.getByLabelText("Keywords, separated by commas"), { target: { value: "Austin" } });
  fireEvent.click(screen.getByRole("button", { name: "Save alert" }));
  const saved = JSON.parse(localStorage.getItem("candidate-job-alerts:candidate-1")!);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ name: "Nurse", keywords: ["Austin"] });
});
