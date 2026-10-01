import { describe, expect, it } from "vitest";
import { resolveSubmissionResumeIdentity } from "./resolve-submission-identity";

describe("resolveSubmissionResumeIdentity", () => {
  it("prefers edited worker name, phone, and email over stale profile values", () => {
    const identity = resolveSubmissionResumeIdentity({
      worker: {
        first_name: "Alex",
        last_name: "Rivera",
        email: "alex.rivera@example.com",
        phone: "5125550199",
        city: "Austin",
        state: "TX",
      },
      profile: {
        first_name: "Old",
        last_name: "Name linkedin.com/in/old-name",
        email: "old@example.com",
        phone: "2125550100",
        city_state_zip: "New York, NY 10001",
      },
      jobTitle: "IT Project Manager",
    });

    expect(identity).toEqual({
      fullName: "Alex Rivera",
      email: "alex.rivera@example.com",
      phone: "5125550199",
      location: "Austin, TX",
      jobTitle: "IT Project Manager",
    });
  });

  it("falls back to profile when worker identity is empty", () => {
    const identity = resolveSubmissionResumeIdentity({
      worker: { first_name: null, last_name: null, email: null, phone: null },
      profile: {
        first_name: "Jane",
        last_name: "Doe",
        email: "jane@example.com",
        phone: "5125550199",
        city_state_zip: "Austin, TX 78701",
      },
      jobTitle: null,
    });

    expect(identity.fullName).toBe("Jane Doe");
    expect(identity.email).toBe("jane@example.com");
    expect(identity.phone).toBe("5125550199");
    expect(identity.location).toBe("Austin, TX 78701");
    expect(identity.jobTitle).toBe("this assignment");
  });
});
