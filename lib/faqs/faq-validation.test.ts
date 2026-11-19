import { describe, expect, it } from "vitest";
import { countWords, validateFaqFields } from "@/lib/faqs/faq-validation";

describe("countWords", () => {
  it("counts whitespace-separated words", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
    expect(countWords("General")).toBe(1);
    expect(countWords("  How  do  I  ")).toBe(3);
  });
});

describe("validateFaqFields", () => {
  it("requires category with at least one word", () => {
    expect(validateFaqFields({ category: "", question: "How do?", answer: "Do this." })).toEqual({
      category: "Category is required.",
    });
  });

  it("requires question with at least two words", () => {
    expect(
      validateFaqFields({ category: "General", question: "Help", answer: "Do this." })
    ).toEqual({
      question: "Question must contain at least two words.",
    });
    expect(
      validateFaqFields({ category: "General", question: "", answer: "Do this." })
    ).toEqual({
      question: "Question is required.",
    });
  });

  it("requires answer with at least two words", () => {
    expect(
      validateFaqFields({ category: "General", question: "How do?", answer: "Yes" })
    ).toEqual({
      answer: "Answer must contain at least two words.",
    });
    expect(
      validateFaqFields({ category: "General", question: "How do?", answer: "" })
    ).toEqual({
      answer: "Answer is required.",
    });
  });

  it("passes valid fields", () => {
    expect(
      validateFaqFields({
        category: "General",
        question: "How do I reset?",
        answer: "Use the reset link.",
      })
    ).toEqual({});
  });
});
