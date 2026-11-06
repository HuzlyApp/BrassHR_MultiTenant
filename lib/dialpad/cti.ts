export const DIALPAD_CTI_ORIGIN = "https://dialpad.com";
export const DIALPAD_CTI_SRC = "https://dialpad.com/apps/open";

export type DialpadCtiCommand = {
  api: "opencti_dialpad";
  version: "1.0";
  method: "initiate_call" | "enable_current_tab" | "hang_up_all_calls" | "mute_call" | "unmute_call";
  payload?: { phone_number: string; enable_current_tab: boolean };
};

export type DialpadCtiEvent =
  | { method: "user_authentication"; userId: string | null; authenticated: boolean }
  | { method: "call_ringing"; state: "on" | "off"; callId: string | null };

export function dialpadCtiCommand(
  method: DialpadCtiCommand["method"],
  payload?: DialpadCtiCommand["payload"]
): DialpadCtiCommand {
  return payload
    ? { api: "opencti_dialpad", version: "1.0", method, payload }
    : { api: "opencti_dialpad", version: "1.0", method };
}

export function postDialpadCti(
  target: { postMessage: (message: unknown, origin: string) => void } | null | undefined,
  command: DialpadCtiCommand
): void {
  target?.postMessage(command, DIALPAD_CTI_ORIGIN);
}

export function parseDialpadCtiEvent(data: unknown, origin: string): DialpadCtiEvent | null {
  if (origin !== DIALPAD_CTI_ORIGIN || !data || typeof data !== "object") return null;
  const message = data as { api?: unknown; method?: unknown; payload?: unknown };
  if (message.api !== "opencti_dialpad" || typeof message.method !== "string") return null;
  const payload =
    message.payload && typeof message.payload === "object"
      ? (message.payload as Record<string, unknown>)
      : {};

  if (message.method === "user_authentication") {
    const userId =
      typeof payload.user_id === "number" || typeof payload.user_id === "string"
        ? String(payload.user_id)
        : null;
    return {
      method: "user_authentication",
      authenticated: payload.user_authenticated === true,
      userId,
    };
  }

  if (message.method === "call_ringing") {
    const callId =
      typeof payload.id === "number" || typeof payload.id === "string" ? String(payload.id) : null;
    return {
      method: "call_ringing",
      state: payload.state === "off" ? "off" : "on",
      callId,
    };
  }

  return null;
}
