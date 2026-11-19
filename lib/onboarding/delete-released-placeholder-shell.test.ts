import { describe, expect, it, vi } from "vitest"
import {
  isSafeReleasedPlaceholderShell,
  deleteReleasedPlaceholderShell,
} from "@/lib/onboarding/delete-released-placeholder-shell"

const deleteOrphanWorkersAfterApplicationDelete = vi.hoisted(() =>
  vi.fn(async () => ({ deletedWorkerIds: [] as string[] }))
)

vi.mock("@/lib/jobs/service", () => ({
  deleteOrphanWorkersAfterApplicationDelete: (...args: unknown[]) =>
    deleteOrphanWorkersAfterApplicationDelete(...args),
}))

describe("isSafeReleasedPlaceholderShell", () => {
  it("allows a released Applicant User shell with placeholder phone", () => {
    expect(
      isSafeReleasedPlaceholderShell(
        {
          id: "shell-1",
          user_id: null,
          email: "",
          phone: "0000000000",
          first_name: "Applicant",
          last_name: "User",
        },
        "real-1"
      )
    ).toBe(true)
  })

  it("rejects shells that still have auth, email, real phone, or a real name", () => {
    expect(
      isSafeReleasedPlaceholderShell(
        {
          id: "shell-1",
          user_id: "auth-1",
          email: "",
          phone: "0000000000",
          first_name: "Applicant",
          last_name: "User",
        },
        "real-1"
      )
    ).toBe(false)
    expect(
      isSafeReleasedPlaceholderShell(
        {
          id: "shell-1",
          user_id: null,
          email: "a@b.com",
          phone: "0000000000",
          first_name: "Applicant",
          last_name: "User",
        },
        "real-1"
      )
    ).toBe(false)
    expect(
      isSafeReleasedPlaceholderShell(
        {
          id: "shell-1",
          user_id: null,
          email: "",
          phone: "5551234567",
          first_name: "Applicant",
          last_name: "User",
        },
        "real-1"
      )
    ).toBe(false)
    expect(
      isSafeReleasedPlaceholderShell(
        {
          id: "shell-1",
          user_id: null,
          email: "",
          phone: "0000000000",
          first_name: "Jane",
          last_name: "Doe",
        },
        "real-1"
      )
    ).toBe(false)
  })
})

describe("deleteReleasedPlaceholderShell", () => {
  it("deletes a safe released placeholder with no remaining applications", async () => {
    deleteOrphanWorkersAfterApplicationDelete.mockResolvedValueOnce({
      deletedWorkerIds: ["shell-1"],
    })
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: "shell-1",
        user_id: null,
        email: "",
        phone: "0000000000",
        first_name: "Applicant",
        last_name: "User",
      },
      error: null,
    }))
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle })),
          })),
        })),
      })),
    }

    const result = await deleteReleasedPlaceholderShell(supabase as never, {
      tenantId: "tenant-1",
      shellWorkerId: "shell-1",
      resolvedWorkerId: "real-1",
    })

    expect(result).toEqual({ deleted: true, reason: undefined })
    expect(deleteOrphanWorkersAfterApplicationDelete).toHaveBeenCalledWith(
      expect.anything(),
      "tenant-1",
      ["shell-1"]
    )
  })

  it("does not delete when the shell still has applications", async () => {
    deleteOrphanWorkersAfterApplicationDelete.mockResolvedValueOnce({
      deletedWorkerIds: [],
    })
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: "shell-1",
        user_id: null,
        email: null,
        phone: "0000000000",
        first_name: "Applicant",
        last_name: "User",
      },
      error: null,
    }))
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle })),
          })),
        })),
      })),
    }

    const result = await deleteReleasedPlaceholderShell(supabase as never, {
      tenantId: "tenant-1",
      shellWorkerId: "shell-1",
      resolvedWorkerId: "real-1",
    })

    expect(result).toEqual({ deleted: false, reason: "still_has_applications" })
  })
})
