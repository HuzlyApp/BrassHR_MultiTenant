import { countWords } from "@/lib/text/word-count";

export type TicketSubjectMessageErrors = {
  subject?: string;
  description?: string;
};

export function validateTicketSubjectAndMessage(input: {
  subject: string;
  description: string;
}): TicketSubjectMessageErrors {
  const errors: TicketSubjectMessageErrors = {};
  const subject = input.subject.trim();
  const description = input.description.trim();

  if (!subject) {
    errors.subject = "Subject is required.";
  } else if (countWords(subject) < 2) {
    errors.subject = "Subject must contain at least two words.";
  }

  if (!description) {
    errors.description = "Message is required.";
  } else if (countWords(description) < 5) {
    errors.description = "Message must contain at least five words.";
  }

  return errors;
}

export function firstTicketSubjectMessageError(
  errors: TicketSubjectMessageErrors
): string | null {
  return errors.subject ?? errors.description ?? null;
}
