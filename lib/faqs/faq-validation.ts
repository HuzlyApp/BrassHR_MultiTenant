import { countWords } from "@/lib/text/word-count";

export type FaqFieldErrors = {
  category?: string;
  question?: string;
  answer?: string;
};

export { countWords };

export function validateFaqFields(input: {
  category: string;
  question: string;
  answer: string;
}): FaqFieldErrors {
  const errors: FaqFieldErrors = {};
  const category = input.category.trim();
  const question = input.question.trim();
  const answer = input.answer.trim();

  if (!category) {
    errors.category = "Category is required.";
  } else if (countWords(category) < 1) {
    errors.category = "Category must contain at least one word.";
  }

  if (!question) {
    errors.question = "Question is required.";
  } else if (countWords(question) < 2) {
    errors.question = "Question must contain at least two words.";
  }

  if (!answer) {
    errors.answer = "Answer is required.";
  } else if (countWords(answer) < 2) {
    errors.answer = "Answer must contain at least two words.";
  }

  return errors;
}

export function firstFaqFieldError(errors: FaqFieldErrors): string | null {
  return errors.category ?? errors.question ?? errors.answer ?? null;
}
