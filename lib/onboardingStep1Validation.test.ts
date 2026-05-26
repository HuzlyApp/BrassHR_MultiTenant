import { describe, expect, it } from "vitest"
import {
  STEP1_ADDRESS_NOT_VERIFIED_MESSAGE,
  validateStep1Form,
} from "@/lib/onboardingStep1Validation"

const completeForm = {
  firstName: "Jane",
  lastName: "Doe",
  address1: "123 Main St",
  address2: "Apt 1",
  city: "Los Angeles",
  state: "California",
  zipCode: "90012",
  phone: "5551234567",
  email: "jane@example.com",
  jobRole: "RN",
}

describe("validateStep1Form address verification", () => {
  it("allows save when addressVerified is true", () => {
    expect(validateStep1Form(completeForm, { addressVerified: true })).toBeNull()
  })

  it("blocks save when addressVerified is false", () => {
    const issue = validateStep1Form(completeForm, { addressVerified: false })
    expect(issue?.code).toBe("ADDRESS")
    expect(issue?.message).toBe(STEP1_ADDRESS_NOT_VERIFIED_MESSAGE)
  })

  it("skips address check when addressVerified is omitted", () => {
    expect(validateStep1Form(completeForm)).toBeNull()
  })
})
