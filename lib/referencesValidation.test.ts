import { describe, expect, it } from "vitest"
import {
  emptyReferenceRow,
  getReferencesSaveError,
  isReferenceComplete,
  MIN_COMPLETE_REFERENCES,
} from "@/lib/referencesValidation"

describe("referencesValidation", () => {
  it("defaults to requiring one complete reference", () => {
    expect(MIN_COMPLETE_REFERENCES).toBe(1)
  })

  it("requires contact + relationship + company + job title", () => {
    const partial = {
      ...emptyReferenceRow(),
      first: "Jane",
      last: "Doe",
      phone: "2015550198",
      email: "jane@example.com",
    }
    expect(isReferenceComplete(partial)).toBe(false)
    expect(
      isReferenceComplete({
        ...partial,
        relationship: "Former manager",
        company: "Acme",
        jobTitle: "RN Supervisor",
      })
    ).toBe(true)
  })

  it("validates email and phone formats", () => {
    expect(
      getReferencesSaveError([
        {
          ...emptyReferenceRow(),
          first: "Jane",
          last: "Doe",
          phone: "123",
          email: "not-an-email",
          relationship: "Peer",
          company: "Acme",
          jobTitle: "Nurse",
        },
      ])
    ).toMatch(/email|phone|Complete/i)
  })
})
