import { describe, expect, it } from "vitest";
import { normalizeWorkerPayRateAmount } from "./worker-pay-rate";
import { filterCandidateFieldInput, validateCandidateFieldInput } from "./worker-profile-field-client";
import { normalizeWorkerFieldValue } from "./worker-profile-field-update";

describe("profile edits preserve input instead of corrupting values", () => {
  it.each(["20-30", "-5", "25.999", "abc", "1e3", "0", "12.3.4"])("rejects invalid pay %s on client and API", raw => {
    expect(filterCandidateFieldInput("hourly_rate", raw)).toBe(raw);
    expect(normalizeWorkerPayRateAmount(raw).ok).toBe(false);
    expect(validateCandidateFieldInput("hourly_rate", raw).ok).toBe(false);
    expect(normalizeWorkerFieldValue("hourly_rate", raw).ok).toBe(false);
  });
  it.each([["25", "25.00"], ["25.99", "25.99"], [".50", "0.50"]])("preserves agreed pay %s", (raw, value) => {
    expect(normalizeWorkerPayRateAmount(raw)).toEqual({ ok: true, value });
    expect(normalizeWorkerFieldValue("hourly_rate", raw)).toEqual({ ok: true, dbValue: value });
  });
  it.each(["1234", "123456", "12a45", "1234567890"])("rejects ZIP %s without padding or truncation", raw => {
    expect(validateCandidateFieldInput("zip", filterCandidateFieldInput("zip", raw)).ok).toBe(false);
    expect(normalizeWorkerFieldValue("zip", raw).ok).toBe(false);
  });
  it.each([["01234", "01234"], ["123456789", "12345-6789"], ["12345-6789", "12345-6789"]])("keeps valid ZIP %s", (raw, value) => {
    expect(validateCandidateFieldInput("zip", raw)).toEqual({ ok: true, value });
    expect(normalizeWorkerFieldValue("zip", raw)).toEqual({ ok: true, dbValue: value });
  });
  it.each(["abcd", "02/30/2000", "01/01/2099"])("rejects invalid DOB %s before saving", raw => {
    expect(validateCandidateFieldInput("date_of_birth", filterCandidateFieldInput("date_of_birth", raw)).ok).toBe(false);
    expect(normalizeWorkerFieldValue("date_of_birth", raw).ok).toBe(false);
  });
  it("preserves typed letters for a format error and rejects invalid ISO calendar dates", () => {
    expect(filterCandidateFieldInput("date_of_birth", "abcd")).toBe("abcd");
    expect(validateCandidateFieldInput("date_of_birth", "abcd")).toMatchObject({ ok: false, error: "Use MM/DD/YYYY format." });
    expect(normalizeWorkerFieldValue("date_of_birth", "2000-02-30").ok).toBe(false);
    expect(normalizeWorkerFieldValue("date_of_birth", "2000-02-29")).toEqual({ ok: true, dbValue: "2000-02-29" });
  });
});
