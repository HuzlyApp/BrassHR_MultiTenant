export type HelpAssistantButton = {
  label: string;
  action: "message_recruiter" | "create_support_ticket";
};

export type HelpAssistantAnswerResponse = {
  type: "answer";
  message: string;
  source: "faq";
};

export type HelpAssistantFallbackResponse = {
  type: "fallback";
  message: string;
  buttons: HelpAssistantButton[];
};

export type HelpAssistantTicketCreatedResponse = {
  type: "support_ticket_created";
  message: string;
  ticket_id: string;
};

export type HelpAssistantResponse =
  | HelpAssistantAnswerResponse
  | HelpAssistantFallbackResponse
  | HelpAssistantTicketCreatedResponse;

export const HELP_FALLBACK_MESSAGE =
  "I'm not able to answer that based on the available help information. Please choose one of the options below.";

export const HELP_FALLBACK_BUTTONS: HelpAssistantButton[] = [
  { label: "Contact Recruiter", action: "message_recruiter" },
  { label: "Create Support Ticket", action: "create_support_ticket" },
];

export const HELP_TICKET_CREATED_MESSAGE = "Your support ticket has been created.";

export const HELP_TICKET_FAILED_MESSAGE =
  "I couldn't create the support ticket right now. Please try again or contact your recruiter directly.";
