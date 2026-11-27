import { describe, expect, it } from "vitest";
import { validateAddCandidateField } from "./add-candidate-validation";
import { isValidStep1Email, isValidStep1Phone } from "@/lib/onboardingStep1Validation";

describe("applicant contact validation", () => {
  it.each(["abc", "123", "12345678901234567890", "call 2135550198"])("rejects invalid phone %s", phone => {
    expect(validateAddCandidateField("phone", { phone })).toBeTruthy();
    expect(isValidStep1Phone(phone)).toBe(false);
  });
  it.each(["(213) 555-0198", "+63 917 123 4567"])("allows a formatted phone %s on Add Applicant", phone => {
    expect(validateAddCandidateField("phone", { phone })).toBeNull();
  });
  it.each(["a@b.c", "a@b", "a@@b.com", "a b@example.com", "a@example.com."])("rejects invalid email %s on both apply paths", email => {
    expect(validateAddCandidateField("email", { email })).toBeTruthy();
    expect(isValidStep1Email(email)).toBe(false);
  });
  it.each(["a@b.co", "name+tag@sub.example.com", "a@example.xn--p1ai"])("accepts email %s", email => {
    expect(validateAddCandidateField("email", { email })).toBeNull();
    expect(isValidStep1Email(email)).toBe(true);
  });
});
