import { describe, expect, it, vi } from "vitest";
const navigation = vi.hoisted(() => ({ redirect: vi.fn(), notFound: vi.fn(() => { throw new Error("not found"); }) }));
vi.mock("next/navigation", () => navigation);
import CareersPage from "./page";

describe("tenant careers landing", () => {
  it("routes to the tenant's existing public jobs board", async () => {
    await CareersPage({ params: Promise.resolve({ tenant: "ZippyCorp" }) });
    expect(navigation.redirect).toHaveBeenCalledWith("/jobs?tenant=zippycorp");
  });
  it("rejects invalid tenant slugs", async () => {
    await expect(CareersPage({ params: Promise.resolve({ tenant: "bad/tenant" }) })).rejects.toThrow("not found");
  });
});
