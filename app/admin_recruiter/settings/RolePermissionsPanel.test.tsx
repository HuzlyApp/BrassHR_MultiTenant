// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import RolePermissionsPanel from "./RolePermissionsPanel";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("roles pagination", () => {
  it("shows six roles on the first page and the seventh on the next", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      roles: Array.from({ length: 7 }, (_, index) => ({ roleKey: `role_${index}`, label: `QA role ${index + 1}`, description: "Team role", isSystem: false, isAdmin: false, userCount: 0, permissions: [] })),
    }) }));
    render(<RolePermissionsPanel canEdit canDelete />);
    await screen.findByText("QA role 7");
    fireEvent.change(screen.getByRole("combobox", { name: "Rows per page" }), { target: { value: "6" } });
    expect(screen.getByText("QA role 6")).toBeInTheDocument();
    expect(screen.queryByText("QA role 7")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText("QA role 7")).toBeInTheDocument();
    expect(screen.queryByText("QA role 6")).not.toBeInTheDocument();
  });
});
