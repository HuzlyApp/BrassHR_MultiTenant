// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JobsPortalClient from "@/app/jobs/JobsPortalClient";
import { PUBLIC_JOBS_DESKTOP_MIN_WIDTH } from "@/lib/jobs/public-jobs-board";

const { nav } = vi.hoisted(() => {
  const params = new URLSearchParams("tenant=zipstaff");
  return {
    nav: {
      params,
      replace: vi.fn(),
      setSearch(search: string) {
        const next = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
        for (const key of [...params.keys()]) params.delete(key);
        next.forEach((value, key) => params.set(key, value));
      },
    },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  useSearchParams: () => nav.params,
}));

vi.mock("@/app/components/tenant/TenantBrandingContext", () => ({
  useTenantBranding: () => ({ companyName: "ZipStaff", primaryHex: "#0D9488" }),
}));

vi.mock("@/lib/tenant/resolve-tenant-context", () => ({
  resolveTenantSlugForClient: () => ({ slug: "zipstaff" }),
}));

function stubMatchMedia(desktop: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: desktop && query.includes(String(PUBLIC_JOBS_DESKTOP_MIN_WIDTH)),
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    }),
  });
}

function makeJob(token: string, title: string, extra: Record<string, unknown> = {}) {
  return {
    id: token,
    public_job_token: token,
    public_title: title,
    public_description:
      extra.public_description ??
      `<p>About the Job</p><p>${title}</p><p>Lead&nbsp;patient care for ${title}.</p><script>alert(1)</script>`,
    location: extra.location ?? "Dallas, TX, USA",
    location_type: extra.location_type ?? "On-site",
    schedule: extra.schedule ?? "Days",
    employment_type: extra.employment_type ?? "W2",
    pay_rate_min: extra.pay_rate_min ?? 40,
    pay_rate_max: extra.pay_rate_max ?? 50,
    pay_rate_period: extra.pay_rate_period ?? "Hourly",
    show_pay_by: extra.show_pay_by ?? "Range",
    qualifications: extra.qualifications ?? "Active RN license",
    responsibilities: extra.responsibilities ?? "Provide bedside care",
    benefits: extra.benefits ?? "Health Insurance, 401(k)",
    published_at: extra.published_at ?? "2026-08-01T00:00:00.000Z",
    workflow_id: extra.workflow_id ?? "wf-1",
    professions: { name: extra.profession ?? "Nursing" },
    specialties: { name: extra.specialty ?? "ICU" },
    ...extra,
  };
}

const defaultJobs = [
  makeJob("rn-1", "Travel RN"),
  makeJob("rn-2", "ICU Nurse", { employment_type: "Contract", location: "Austin, TX" }),
];

function mockJobsResponse(overrides: Record<string, unknown> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        jobs: defaultJobs,
        total: 2,
        tenant: { slug: "zipstaff", name: "ZipStaff" },
        filters: {
          professions: [{ id: "prof-nursing", name: "Nursing" }],
          specialties: [{ id: "spec-icu", name: "ICU", profession_id: "prof-nursing" }],
          employmentTypes: ["W2", "1099", "Contract"],
        },
        ...overrides,
      }),
    }))
  );
}

async function renderBoard(search = "tenant=zipstaff", desktop = true) {
  stubMatchMedia(desktop);
  nav.setSearch(search);
  nav.replace.mockClear();
  const view = render(<JobsPortalClient />);
  return view;
}

describe("JobsPortalClient", () => {
  beforeEach(() => {
    mockJobsResponse();
    stubMatchMedia(true);
    nav.setSearch("tenant=zipstaff");
    nav.replace.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a desktop split view with stacked result cards", async () => {
    await renderBoard();
    const split = await screen.findByTestId("jobs-split-view");
    expect(split.className).toContain("lg:flex");
    expect(screen.getByTestId("jobs-results-panel").className).toContain("lg:w-[40%]");
    expect(screen.getByLabelText("Selected job details").className).toContain("lg:w-[60%]");
    expect(await screen.findByTestId("job-card-rn-1")).toBeInTheDocument();
    expect(screen.queryByText(/Page \d+ of \d+/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("jobs-split-view")).toHaveAttribute("data-layout", "split");
    expect(screen.queryByRole("link", { name: /view details/i })).not.toBeInTheDocument();
  });

  it("selects the first result on initial load", async () => {
    await renderBoard();
    const first = await screen.findByTestId("job-card-rn-1");
    await waitFor(() => expect(first).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByRole("heading", { name: "Travel RN" })).toBeInTheDocument();
    expect(nav.replace).toHaveBeenCalledWith(
      expect.stringContaining("job=rn-1"),
      expect.objectContaining({ scroll: false })
    );
  });

  it("updates the details panel and URL when a card is clicked", async () => {
    const user = userEvent.setup();
    await renderBoard();
    await screen.findByTestId("job-card-rn-1");
    const fetchCount = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
    await user.click(screen.getByTestId("job-card-rn-2"));
    expect(screen.getByRole("heading", { name: "ICU Nurse" })).toBeInTheDocument();
    expect(screen.getByTestId("job-card-rn-2")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("job-card-rn-1")).toHaveAttribute("aria-pressed", "false");
    expect(nav.replace).toHaveBeenCalledWith(
      expect.stringContaining("job=rn-2"),
      expect.objectContaining({ scroll: false })
    );
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(fetchCount);
  });

  it("shows the selected job details and apply route", async () => {
    const user = userEvent.setup();
    await renderBoard();
    await screen.findByTestId("job-card-rn-1");
    await user.click(screen.getByTestId("job-card-rn-2"));
    const apply = screen.getByTestId("jobs-apply-button");
    expect(apply).toHaveAttribute("href", "/apply?tenant=zipstaff&job_token=rn-2");
    expect(within(screen.getByTestId("jobs-detail-panel")).getByText(/Lead patient care for ICU Nurse/i)).toBeInTheDocument();
  });

  it("does not apply to a previously selected job after a rapid selection change", async () => {
    const user = userEvent.setup();
    await renderBoard();
    await screen.findByTestId("job-card-rn-1");
    await user.click(screen.getByTestId("job-card-rn-1"));
    await user.click(screen.getByTestId("job-card-rn-2"));
    expect(screen.getByTestId("jobs-apply-button")).toHaveAttribute(
      "href",
      "/apply?tenant=zipstaff&job_token=rn-2"
    );
  });

  it.each([
    ["keyword", "Search jobs, titles, or keywords", "ICU", "q=ICU"],
    ["location", "Location", "Austin", "location=Austin"],
  ])("searches by %s", async (_label, aria, value, expected) => {
    const user = userEvent.setup();
    await renderBoard();
    await screen.findByTestId("job-card-rn-1");
    nav.replace.mockClear();
    await user.clear(screen.getByLabelText(aria));
    await user.type(screen.getByLabelText(aria), value);
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(nav.replace).toHaveBeenCalledWith(
      expect.stringContaining(expected),
      expect.objectContaining({ scroll: false })
    );
  });

  it.each([
    ["Profession", "prof-nursing", "professionId=prof-nursing"],
    ["Employment type", "Contract", "employmentType=Contract"],
  ])("filters by %s from the compact chip row", async (aria, value, expected) => {
    const user = userEvent.setup();
    await renderBoard();
    await screen.findByTestId("job-card-rn-1");
    nav.replace.mockClear();
    await user.selectOptions(screen.getByLabelText(aria), value);
    expect(nav.replace).toHaveBeenCalledWith(
      expect.stringContaining(expected),
      expect.objectContaining({ scroll: false })
    );
  });

  it("filters by specialty from the All filters sheet", async () => {
    const user = userEvent.setup();
    await renderBoard();
    await screen.findByTestId("job-card-rn-1");
    nav.replace.mockClear();
    await user.click(screen.getByTestId("jobs-all-filters"));
    await user.selectOptions(await screen.findByLabelText("Specialty"), "spec-icu");
    expect(nav.replace).toHaveBeenCalledWith(
      expect.stringContaining("specialtyId=spec-icu"),
      expect.objectContaining({ scroll: false })
    );
  });

  it("applies combined filters from the URL and can clear secondary filters", async () => {
    const user = userEvent.setup();
    await renderBoard(
      "tenant=zipstaff&q=RN&professionId=prof-nursing&specialtyId=spec-icu&location=Dallas&employmentType=W2&job=rn-2"
    );
    expect(await screen.findByLabelText("Search jobs, titles, or keywords")).toHaveValue("RN");
    expect(screen.getByLabelText("Profession")).toHaveValue("prof-nursing");
    expect(screen.getByLabelText("Location")).toHaveValue("Dallas");
    expect(screen.getByLabelText("Employment type")).toHaveValue("W2");
    expect(screen.getByTestId("jobs-active-chip-specialtyId")).toHaveTextContent("ICU");
    await waitFor(() =>
      expect(screen.getByTestId("job-card-rn-2")).toHaveAttribute("aria-pressed", "true")
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/public/jobs?tenant=zipstaff"),
      expect.anything()
    );
    const calledUrl = String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0]);
    expect(calledUrl).toContain("q=RN");
    expect(calledUrl).toContain("professionId=prof-nursing");
    expect(calledUrl).toContain("specialtyId=spec-icu");
    expect(calledUrl).toContain("location=Dallas");
    expect(calledUrl).toContain("employmentType=W2");
    expect(calledUrl).not.toContain("job=");
    nav.replace.mockClear();
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(nav.replace).toHaveBeenCalledWith(
      expect.stringMatching(/tenant=zipstaff/),
      expect.objectContaining({ scroll: false })
    );
    const cleared = String(nav.replace.mock.calls.at(-1)?.[0]);
    expect(cleared).toContain("q=RN");
    expect(cleared).not.toContain("professionId=");
    expect(cleared).not.toContain("employmentType=");
  });

  it("removes an active filter chip", async () => {
    const user = userEvent.setup();
    await renderBoard("tenant=zipstaff&professionId=prof-nursing");
    await screen.findByTestId("jobs-active-chip-professionId");
    nav.replace.mockClear();
    await user.click(screen.getByRole("button", { name: "Remove Nursing filter" }));
    expect(nav.replace).toHaveBeenCalledWith(
      expect.not.stringContaining("professionId="),
      expect.objectContaining({ scroll: false })
    );
  });

  it("preserves filters and the selected job after a refresh-style remount", async () => {
    const { unmount } = await renderBoard("tenant=zipstaff&q=nurse&page=1&job=rn-2");
    await screen.findByTestId("job-card-rn-2");
    unmount();
    await renderBoard("tenant=zipstaff&q=nurse&page=1&job=rn-2");
    expect(await screen.findByLabelText("Search jobs, titles, or keywords")).toHaveValue("nurse");
    await waitFor(() =>
      expect(screen.getByTestId("job-card-rn-2")).toHaveAttribute("aria-pressed", "true")
    );
    expect(screen.getByRole("heading", { name: "ICU Nurse" })).toBeInTheDocument();
  });

  it("requests the next page without dropping tenant scope", async () => {
    const user = userEvent.setup();
    mockJobsResponse({ total: 14 });
    await renderBoard();
    await screen.findByTestId("job-card-rn-1");
    nav.replace.mockClear();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(nav.replace).toHaveBeenCalledWith(
      expect.stringContaining("page=2"),
      expect.objectContaining({ scroll: false })
    );
  });

  it("opens a mobile detail view and restores the list with Back to jobs", async () => {
    const user = userEvent.setup();
    await renderBoard("tenant=zipstaff", false);
    const card = await screen.findByTestId("job-card-rn-2");
    await user.click(card);
    expect(screen.getByTestId("jobs-back-to-jobs")).toBeVisible();
    expect(screen.getByRole("heading", { name: "ICU Nurse" })).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByTestId("jobs-back-to-jobs"));
    await user.click(screen.getByTestId("jobs-back-to-jobs"));
    expect(screen.getByTestId("jobs-results-panel").className).not.toContain("hidden");
    expect(nav.replace).toHaveBeenCalledWith(
      expect.stringContaining("job=rn-2"),
      expect.objectContaining({ scroll: false })
    );
  });

  it("shows loading skeletons, empty filter results, and API errors", async () => {
    let finish: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          })
      )
    );
    await renderBoard();
    expect(screen.getByTestId("jobs-loading")).toBeInTheDocument();
    finish({
      ok: true,
      json: async () => ({
        jobs: [],
        total: 0,
        tenant: { slug: "zipstaff", name: "ZipStaff" },
        filters: { professions: [], specialties: [], employmentTypes: [] },
      }),
    });
    expect(await screen.findByTestId("jobs-empty")).toHaveTextContent(/no open positions/i);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          jobs: [],
          total: 0,
          tenant: { slug: "zipstaff", name: "ZipStaff" },
          filters: { professions: [], specialties: [], employmentTypes: [] },
        }),
      }))
    );
    nav.setSearch("tenant=zipstaff&q=zzzz");
    render(<JobsPortalClient />);
    expect(await screen.findByText(/No jobs matched your search/i)).toBeInTheDocument();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: "Jobs are temporarily unavailable" }),
      }))
    );
    nav.setSearch("tenant=zipstaff");
    render(<JobsPortalClient />);
    expect(await screen.findByTestId("jobs-error")).toHaveTextContent("Jobs are temporarily unavailable");
  });

  it("supports keyboard selection of job cards", async () => {
    const user = userEvent.setup();
    await renderBoard();
    const second = await screen.findByTestId("job-card-rn-2");
    second.focus();
    await user.keyboard("{Enter}");
    expect(second).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "ICU Nurse" })).toBeInTheDocument();
  });

  it("does not show raw HTML or duplicated headings in result cards", async () => {
    await renderBoard();
    const card = await screen.findByTestId("job-card-rn-1");
    expect(card.textContent).not.toMatch(/<|>|&nbsp;|About the Job|Lead patient care/);
    const heading = await screen.findByRole("heading", { name: "Travel RN" });
    expect(heading).toBeInTheDocument();
    const panel = screen.getByTestId("jobs-detail-panel");
    expect(within(panel).getByText(/Lead patient care for Travel RN/i)).toBeInTheDocument();
    expect(panel.innerHTML).not.toContain("<script");
    expect(panel.textContent).not.toContain("&nbsp;");
  });

  it("keeps fetches tenant-scoped to published public jobs", async () => {
    await renderBoard();
    await screen.findByTestId("job-card-rn-1");
    const urls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map((call) => String(call[0]));
    expect(urls.every((url) => url.includes("tenant=zipstaff"))).toBe(true);
    expect(urls.every((url) => url.startsWith("/api/public/jobs?"))).toBe(true);
  });

  it("uses stacked list layout classes at tablet/mobile widths", async () => {
    await renderBoard("tenant=zipstaff", false);
    await screen.findByTestId("job-card-rn-1");
    expect(screen.getByTestId("jobs-split-view")).toHaveAttribute("data-layout", "stack");
    expect(screen.getByTestId("jobs-results-panel").className).toContain("flex");
    expect(screen.getByLabelText("Selected job details").className).toContain("hidden");
  });

  it("opens All filters and restores focus when closed", async () => {
    const user = userEvent.setup();
    await renderBoard();
    await screen.findByTestId("job-card-rn-1");
    const trigger = screen.getByTestId("jobs-all-filters");
    await user.click(trigger);
    expect(await screen.findByRole("heading", { name: "All filters" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("heading", { name: "All filters" })).not.toBeInTheDocument());
  });

  it("truncates long titles on result cards", async () => {
    const longTitle = "Senior Travel Registered Nurse for Cardiovascular Intensive Care Unit Evening Shift";
    mockJobsResponse({
      jobs: [makeJob("rn-long", longTitle)],
      total: 1,
    });
    await renderBoard();
    const card = await screen.findByTestId("job-card-rn-long");
    expect(card.querySelector(".line-clamp-2")?.textContent).toBe(longTitle);
  });

  it("keeps results and details in independently scrollable panels on desktop", async () => {
    await renderBoard();
    await screen.findByTestId("job-card-rn-1");
    expect(screen.getByTestId("jobs-results-panel").querySelector(".jobs-board-scroll")).toBeTruthy();
    expect(screen.getByTestId("jobs-detail-panel").querySelector(".jobs-board-scroll")).toBeTruthy();
  });
});
