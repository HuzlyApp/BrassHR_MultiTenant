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
    ).toEqual({
      method: "call_ringing",
      state: "off",
      callId: "99",
      externalNumber: null,
      contactName: null,
    });

    expect(
      parseDialpadCtiEvent(
        {
          api: "opencti_dialpad",
          method: "call_ringing",
          payload: {
            state: "on",
            id: 5747322335264768,
            external_number: "+16043111111",
            contact: { name: "Jordan Lee", phone: "+16043111111" },
          },
        },
        "https://dialpad.com"
      )
    ).toEqual({
      method: "call_ringing",
      state: "on",
      callId: "5747322335264768",
      externalNumber: "+16043111111",
      contactName: "Jordan Lee",
    });

    expect(dialpadCtiCommand("answer_call")).toEqual({
      api: "opencti_dialpad",
      version: "1.0",
      method: "answer_call",
    });
    expect(dialpadCtiCommand("decline_call", { call_id: "5747322335264768" })).toEqual({
      api: "opencti_dialpad",
      version: "1.0",
      method: "decline_call",
      payload: { call_id: "5747322335264768" },
    });

    expect(parseDialpadCtiEvent({ api: "opencti_dialpad", method: "call_ringing" }, "https://evil.example")).toBeNull();
  });
});
