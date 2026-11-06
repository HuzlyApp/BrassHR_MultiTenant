import { describe, expect, it } from "vitest";
import { dialpadCtiCommand, parseDialpadCtiEvent } from "@/lib/dialpad/cti";

describe("Dialpad CTI messages", () => {
  it("builds the click-to-call command Dialpad's mini dialer expects", () => {
    expect(
      dialpadCtiCommand("initiate_call", {
        phone_number: "+14155550134",
        enable_current_tab: true,
      })
    ).toEqual({
      api: "opencti_dialpad",
      version: "1.0",
      method: "initiate_call",
      payload: { phone_number: "+14155550134", enable_current_tab: true },
    });
  });

  it("reads sign-in and ringing events from Dialpad only", () => {
    expect(
      parseDialpadCtiEvent(
        {
          api: "opencti_dialpad",
          method: "user_authentication",
          payload: { user_authenticated: true, user_id: 22 },
        },
        "https://dialpad.com"
      )
    ).toEqual({ method: "user_authentication", authenticated: true, userId: "22" });

    expect(
      parseDialpadCtiEvent(
        { api: "opencti_dialpad", method: "call_ringing", payload: { state: "off", id: 99 } },
        "https://dialpad.com"
      )
    ).toEqual({ method: "call_ringing", state: "off", callId: "99" });

    expect(parseDialpadCtiEvent({ api: "opencti_dialpad", method: "call_ringing" }, "https://evil.example")).toBeNull();
  });
});
