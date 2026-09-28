import { describe, expect, it } from "vitest";
import { validateCandidateFieldInput } from "@/lib/admin/worker-profile-field-client";
import {
  filterPersonNameInput,
  normalizePersonName,
  reviewParsedCandidateName,
  validatePersonName,
} from "@/lib/person-name";

const FULL_NAME = { maxLength: 80 };

describe("normalizePersonName", () => {
  it("trims, collapses spaces, and strips zero-width characters", () => {
    expect(normalizePersonName("  Mary \u200B  Jane\u00A0 Watson  ")).toBe("Mary Jane Watson");
  });

  it("straightens smart apostrophes, modifier apostrophes, and okina", () => {
    expect(normalizePersonName("O\u2019Connor")).toBe("O'Connor");
    expect(normalizePersonName("D\u02BCAngelo")).toBe("D'Angelo");
    expect(normalizePersonName("Ha\u02BBalilio")).toBe("Ha'alilio");
  });

  it("maps en dash and other hyphen variants to hyphen-minus", () => {
    expect(normalizePersonName("Jean\u2013Luc")).toBe("Jean-Luc");
    expect(normalizePersonName("Smith\u2010Jones")).toBe("Smith-Jones");
  });
});

describe("validatePersonName — FSD section 8 examples", () => {
  it.each([
    "Mary Jane Watson",
    "Jean-Luc Picard",
    "O'Connor",
    "O\u2019Connor",
    "José García",
    "St. John",
    "Robert Jr.",
    "Smith, Jr.",
  ])("passes %s", (input) => {
    expect(validatePersonName(input, FULL_NAME).ok).toBe(true);
  });

  it.each([
    "John Smith linkedin.com/in/john",
    "Jane Doe 919-555-1234",
    "jane@email.com",
    "https://linkedin.com/in/x",
    "O'",
    "-Smith",
  ])("fails %s", (input) => {
    expect(validatePersonName(input, FULL_NAME).ok).toBe(false);
  });
});

describe("validatePersonName — additional rules", () => {
  it("accepts accented, middle-dot, and initials forms", () => {
    for (const name of ["Müller", "François", "Søren", "Lluís·Maria", "J.K. Rowling", "van der Berg"]) {
      expect(validatePersonName(name, FULL_NAME)).toMatchObject({ ok: true });
    }
  });

  it("returns the normalized value on success", () => {
    expect(validatePersonName("  O\u2019Connor ")).toEqual({ ok: true, value: "O'Connor" });
  });

  it("rejects empty, punctuation-only, and digit-only values", () => {
    expect(validatePersonName("   ").ok).toBe(false);
    expect(validatePersonName("--").ok).toBe(false);
    expect(validatePersonName("12").ok).toBe(false);
  });

  it("rejects doubled separators and leading or trailing punctuation", () => {
    for (const name of ["Jean--Luc", "O''Connor", "J..K", "Smith,,", "Smith-", "'Connor", "Smith ,Jr"]) {
      expect(validatePersonName(name, FULL_NAME).ok).toBe(false);
    }
  });

  it("rejects forbidden symbols, parentheses, and emoji", () => {
    for (const name of ["Jane_Doe", "Jane & John", "Jane (JJ) Doe", "Jane!", "Jane 😀"]) {
      expect(validatePersonName(name, FULL_NAME).ok).toBe(false);
    }
  });

  it("rejects phone patterns and digits", () => {
    expect(validatePersonName("Jane (919)")).toMatchObject({ ok: false, error: "Name cannot include a phone number." });
    expect(validatePersonName("Jane +1")).toMatchObject({ ok: false, error: "Name cannot include a phone number." });
    expect(validatePersonName("Jane 2")).toMatchObject({ ok: false, error: "Name cannot include numbers." });
  });

  it("enforces 2 to 50 characters per field by default", () => {
    expect(validatePersonName("J").ok).toBe(false);
    expect(validatePersonName("a".repeat(50)).ok).toBe(true);
    expect(validatePersonName("a".repeat(51), { label: "First name" })).toMatchObject({
      ok: false,
      error: "First name must be 50 characters or fewer.",
    });
  });

  it("uses the field label in error messages", () => {
    expect(validatePersonName("", { label: "Last name" })).toMatchObject({
      ok: false,
      error: "Last name is required.",
    });
  });
});

describe("filterPersonNameInput", () => {
  it("keeps accented letters and name punctuation, drops digits and symbols", () => {
    expect(filterPersonNameInput("José O\u2019Connor-Smith, Jr.")).toBe("José O\u2019Connor-Smith, Jr.");
    expect(filterPersonNameInput("Jane_Doe@919")).toBe("JaneDoe");
  });

  it("caps input at 50 characters", () => {
    expect(filterPersonNameInput("a".repeat(60))).toHaveLength(50);
  });
});

describe("candidate detail name edits", () => {
  it("accepts accented names that the old ASCII-only rule rejected", () => {
    expect(validateCandidateFieldInput("person_name", "Müller")).toEqual({ ok: true, value: "Müller" });
  });

  it("rejects contact data typed into a name", () => {
    expect(validateCandidateFieldInput("person_name", "Jane www.site.org").ok).toBe(false);
  });
});

describe("reviewParsedCandidateName", () => {
  it("auto-accepts clean names without review", () => {
    expect(reviewParsedCandidateName("Jean\u2013Luc", "O\u2019Connor")).toEqual({
      needsReview: false,
      firstName: "Jean-Luc",
      lastName: "O'Connor",
      rawExtract: "Jean\u2013Luc O\u2019Connor",
      firstNameError: null,
      lastNameError: null,
    });
  });

  it("flags header junk and keeps the raw extract for the recruiter", () => {
    const review = reviewParsedCandidateName("John", "Smith linkedin.com/in/john");
    expect(review.needsReview).toBe(true);
    expect(review.firstName).toBe("John");
    expect(review.lastName).toBe("Smith linkedin.com/in/john");
    expect(review.rawExtract).toBe("John Smith linkedin.com/in/john");
    expect(review.firstNameError).toBeNull();
    expect(review.lastNameError).toMatch(/LinkedIn/);
  });

  it("flags empty extracts", () => {
    expect(reviewParsedCandidateName("", "").needsReview).toBe(true);
  });
});
