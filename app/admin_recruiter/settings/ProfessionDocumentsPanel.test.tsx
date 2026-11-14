// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProfessionDocumentsPanel from "@/app/admin_recruiter/settings/ProfessionDocumentsPanel";

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const pushMock = vi.fn();
const replaceMock = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  usePathname: () => "/admin_recruiter/settings/profession",
  useSearchParams: () => searchParams,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: (event: { preventDefault: () => void }) => void;
    className?: string;
  }) => (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          const url = new URL(href, "http://localhost");
          searchParams = url.searchParams;
          pushMock(href);
        }
      }}
    >
      {children}
    </a>
  ),
}));

type Profession = {
  id: string;
  name: string;
  catalogKey: string | null;
  industryKey: string | null;
  documents: Array<{
    id: string;
    name: string;
    documentKind: "certificate" | "license";
    isRequired: boolean;
    hasExpiration: boolean;
    sortOrder: number;
  }>;
};

type AvailableProfession = {
  key: string;
  name: string;
  industryKey: string;
  industryLabel: string | null;
};

describe("ProfessionDocumentsPanel", () => {
  let professions: Profession[];
  let availableProfessions: AvailableProfession[];
  let savedBody: { professionId?: string; documents?: Array<{ name: string; documentKind: string }> } | null;
  let deletedProfessionId: string | null;
  let lastCreateBody: { name?: string; catalogKey?: string; industryKey?: string } | null;
  let lastPatch: { id: string | null; body: { name?: string } | null };

  beforeEach(() => {
    searchParams = new URLSearchParams();
    pushMock.mockReset();
    replaceMock.mockReset();
    professions = [
      {
        id: "nursing",
        name: "Nursing",
        catalogKey: "nursing",
        industryKey: "healthcare",
        documents: [],
      },
    ];
    availableProfessions = [
      { key: "it_support", name: "IT Support", industryKey: "technology", industryLabel: "Technology" },
    ];
    savedBody = null;
    deletedProfessionId = null;
    lastCreateBody = null;
    lastPatch = { id: null, body: null };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (url.endsWith("/api/admin/profession-documents") && method === "GET") {
          return json({
            canManage: true,
            industryKey: "healthcare",
            industryLabel: "Healthcare",
            industries: [
              { key: "healthcare", label: "Healthcare", isPrimary: true },
              { key: "technology", label: "Technology / IT Services", isPrimary: false },
            ],
            availableProfessions,
            professions,
          });
        }
        if (url.endsWith("/api/admin/professions") && method === "POST") {
          const body = JSON.parse(String(init?.body ?? "{}")) as {
            catalogKey?: string;
            name?: string;
            industryKey?: string;
          };
          lastCreateBody = body;
          if (body.name?.trim()) {
            const created: Profession = {
              id: "custom-1",
              name: body.name.trim(),
              catalogKey: null,
              industryKey: "healthcare",
              documents: [],
            };
            professions = [...professions, created];
            return json({ profession: { id: created.id, name: created.name } });
          }
          const chosen = availableProfessions.find((option) => option.key === body.catalogKey);
          const created: Profession = {
            id: "it-support",
            name: chosen?.name ?? "",
            catalogKey: body.catalogKey ?? null,
            industryKey: "technology",
            documents: [],
          };
          professions = [...professions, created];
          availableProfessions = availableProfessions.filter((option) => option.key !== body.catalogKey);
          return json({ profession: { id: created.id, name: created.name } });
        }
        if (url.includes("/api/admin/professions/") && method === "PATCH") {
          const id = url.split("/").pop() ?? null;
          const body = JSON.parse(String(init?.body ?? "{}")) as { name?: string };
          lastPatch = { id, body };
          professions = professions.map((row) =>
            row.id === id ? { ...row, name: body.name?.trim() || row.name } : row
          );
          return json({ profession: { id, name: body.name } });
        }
        if (url.includes("/api/admin/professions/") && method === "DELETE") {
          deletedProfessionId = url.split("/").pop() ?? null;
          professions = professions.filter((row) => row.id !== deletedProfessionId);
          return json({ profession: { id: deletedProfessionId, is_active: false } });
        }
        if (url.endsWith("/api/admin/profession-documents") && method === "PUT") {
          savedBody = JSON.parse(String(init?.body ?? "{}"));
          return json({
            documents: (savedBody?.documents ?? []).map((doc, index) => ({
              id: `saved-${index}`,
              name: doc.name,
              documentKind: doc.documentKind,
              isRequired: true,
              hasExpiration: true,
              sortOrder: (index + 1) * 10,
            })),
          });
        }
        if (url.includes("/api/admin/assessment-settings")) {
          return json({
            canManage: true,
            settings: {
              draft: {
                enabled: true,
                allowSkip: true,
                scoring: {
                  pointsPerQuestion: 1,
                  passingScore: 70,
                  scoreByCategory: true,
                  showOverallScore: true,
                  showResultsToApplicant: false,
                },
                categories: [],
              },
              published: null,
            },
          });
        }
        return json({ error: "Not found" }, 404);
      })
    );
  });

  async function expandIndustry(user: ReturnType<typeof userEvent.setup>, label: string) {
    expect(await screen.findByText(label)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: new RegExp(label) }));
  }

  it("adds a custom profession and saves documents", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ProfessionDocumentsPanel />);

    expect(await screen.findByText("Healthcare")).toBeTruthy();
    expect(screen.getByText("Technology / IT Services")).toBeTruthy();
    await expandIndustry(user, "Healthcare");
    expect(await screen.findByRole("link", { name: "Nursing" })).toBeTruthy();

    await user.type(
      screen.getByLabelText("Custom profession name for Healthcare"),
      "Solar Technician"
    );
    await user.click(screen.getAllByRole("button", { name: "Add profession" })[0]!);

    await waitFor(() => {
      expect(lastCreateBody).toEqual({ name: "Solar Technician", industryKey: "healthcare" });
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/admin_recruiter/settings/profession/custom-1");
    });

    rerender(<ProfessionDocumentsPanel detailProfessionId="custom-1" />);

    expect(await screen.findByRole("heading", { name: "Solar Technician" })).toBeTruthy();
    expect(screen.getByText("No certificates or licenses for Solar Technician yet.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Add certificate or license" }));
    await user.type(screen.getByPlaceholderText("Certificate or license name"), "NABCEP");
    await user.click(screen.getByRole("button", { name: "Save documents" }));

    await waitFor(() => {
      expect(savedBody?.professionId).toBe("custom-1");
    });
    expect(savedBody?.documents).toEqual([
      expect.objectContaining({ name: "NABCEP", documentKind: "certificate" }),
    ]);
  });

  it("adds a catalog profession from the list view", async () => {
    const user = userEvent.setup();
    render(<ProfessionDocumentsPanel />);

    expect(await screen.findByText("Technology / IT Services")).toBeTruthy();
    await expandIndustry(user, "Technology / IT Services");

    await user.click(
      screen.getByLabelText("Select catalog profession for Technology / IT Services")
    );
    await user.click(screen.getByRole("option", { name: "IT Support" }));
    await user.click(screen.getByRole("button", { name: "Add from catalog" }));

    await waitFor(() => {
      expect(lastCreateBody).toEqual({ catalogKey: "it_support", industryKey: "technology" });
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/admin_recruiter/settings/profession/it-support");
    });
  });

  it("opens View docs on the dedicated profession detail page", async () => {
    const user = userEvent.setup();
    professions = [
      {
        id: "nursing",
        name: "Nursing",
        catalogKey: "nursing",
        industryKey: "healthcare",
        documents: [],
      },
      {
        id: "it-support",
        name: "IT Support",
        catalogKey: "it_support",
        industryKey: "technology",
        documents: [
          {
            id: "doc-1",
            name: "CompTIA",
            documentKind: "certificate",
            isRequired: true,
            hasExpiration: true,
            sortOrder: 10,
          },
        ],
      },
    ];
    const { rerender } = render(<ProfessionDocumentsPanel />);

    await expandIndustry(user, "Healthcare");
    await expandIndustry(user, "Technology / IT Services");
    expect(await screen.findByRole("link", { name: "Nursing" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Nursing" })).toBeNull();

    await user.click(screen.getAllByRole("link", { name: "View docs" })[1]!);
    expect(pushMock).toHaveBeenCalledWith("/admin_recruiter/settings/profession/it-support");

    rerender(<ProfessionDocumentsPanel detailProfessionId="it-support" />);

    expect(await screen.findByRole("heading", { name: "IT Support" })).toBeTruthy();
    expect(screen.getByDisplayValue("CompTIA")).toBeTruthy();
    expect(screen.getByLabelText("Switch profession")).toBeTruthy();
  });

  it("edits the selected profession name", async () => {
    const user = userEvent.setup();
    render(<ProfessionDocumentsPanel detailProfessionId="nursing" />);

    expect(await screen.findByRole("heading", { name: "Nursing" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Edit Nursing" }));
    expect(screen.getByRole("dialog", { name: "Edit profession" })).toBeTruthy();

    const nameInput = screen.getByLabelText("Profession name");
    await user.clear(nameInput);
    await user.type(nameInput, "Registered Nurse");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(lastPatch).toEqual({ id: "nursing", body: { name: "Registered Nurse" } });
    });
    expect(await screen.findByRole("heading", { name: "Registered Nurse" })).toBeTruthy();
  });

  it("deletes the selected profession from the detail page", async () => {
    const user = userEvent.setup();
    render(<ProfessionDocumentsPanel detailProfessionId="nursing" />);

    expect(await screen.findByRole("heading", { name: "Nursing" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Delete Nursing" }));
    expect(screen.getByRole("dialog", { name: "Delete Nursing?" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(deletedProfessionId).toBe("nursing");
    });
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/admin_recruiter/settings/profession");
    });
  });
});

function json(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}
