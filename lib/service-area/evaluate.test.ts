import { describe, expect, it } from "vitest";
import { evaluateServiceArea, toPublicServiceAreaDecision } from "@/lib/service-area/evaluate";
import type { ServiceAreaPolicy, TenantHiringArea } from "@/lib/service-area/types";

const NYC_ZIPS = new Set(["10001", "11201", "10451", "10301", "11101"]);

function policy(
  id: string,
  code: string,
  matchType: ServiceAreaPolicy["matchType"],
  states: string[],
  cities: string[] = [],
  postalCodes: string[] = []
): ServiceAreaPolicy {
  return {
    id,
    source: "platform",
    tenantId: null,
    code,
    label: code,
    matchType,
    states,
    cities,
    postalCodes,
    effect: "hold",
    isActive: true,
    messageKey: "location_not_available",
  };
}

const PHASE1: ServiceAreaPolicy[] = [
  policy("p-ca", "CA", "state", ["CA"]),
  policy("p-il", "IL", "state", ["IL"]),
  policy("p-ct", "CT", "state", ["CT"]),
  policy(
    "p-nyc",
    "NYC",
    "city_state",
    ["NY"],
    ["new york", "new york city", "nyc", "manhattan", "brooklyn", "queens", "bronx", "the bronx", "staten island"],
    [...NYC_ZIPS]
  ),
];

const zipLists = { "p-nyc": NYC_ZIPS };

const openPlatform: TenantHiringArea = {
  tenantId: "t1",
  mode: "all_allowed_platform",
  extraAllowedStates: [],
  locations: [],
};

function evaluate(
  location: Parameters<typeof evaluateServiceArea>[0]["location"],
  action: Parameters<typeof evaluateServiceArea>[0]["action"] = "apply",
  hiringArea: TenantHiringArea | null = openPlatform
) {
  return evaluateServiceArea(
    { action, location },
    {
      policies: PHASE1,
      zipListsByPolicyId: zipLists,
      hiringArea,
      enforcePlatformHolds: true,
      enforceHiringArea: true,
    }
  );
}

describe("evaluateServiceArea Phase 1 holds", () => {
  it("allows Raleigh NC onsite", () => {
    const decision = evaluate({
      city: "Raleigh",
      state: "NC",
      locationType: "onsite",
    });
    expect(decision.allowed).toBe(true);
    expect(decision.reasonCode).toBe("ok");
  });

  it("AT-3: Los Angeles work location is platform hold", () => {
    const decision = evaluate({
      city: "Los Angeles",
      state: "CA",
      locationType: "onsite",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("platform_hold");
    expect(decision.layer).toBe("platform");
    expect(decision.messageKey).toBe("location_not_enabled");
  });

  it("AT-4: relocate true evaluates the job worksite, not home", () => {
    const decision = evaluateServiceArea(
      {
        action: "apply",
        location: {
          city: "Los Angeles",
          state: "CA",
          locationType: "onsite",
          relocateToJobSite: true,
        },
      },
      {
        policies: PHASE1,
        zipListsByPolicyId: zipLists,
        hiringArea: openPlatform,
        enforcePlatformHolds: true,
        enforceHiringArea: true,
        jobWorksite: {
          city: "Raleigh",
          state: "NC",
          postalCode: "27601",
          locationType: "onsite",
          remoteAllowedStates: [],
          isPublished: true,
        },
      }
    );
    expect(decision.allowed).toBe(true);
  });

  it("AT-5: Chicago publish is hold; incomplete without city also fails", () => {
    const chicago = evaluate(
      { city: "Chicago", state: "IL", locationType: "onsite" },
      "publish_job"
    );
    expect(chicago.allowed).toBe(false);
    expect(chicago.messageKey).toBe("location_not_enabled");
  });

  it("AT-6: Brooklyn attach is NYC hold", () => {
    const decision = evaluate(
      { city: "Brooklyn", state: "NY", locationType: "onsite" },
      "attach_candidate"
    );
    expect(decision.allowed).toBe(false);
    expect(decision.matchedPolicyId).toBe("p-nyc");
  });

  it("AT-7: Austin TX signup is allowed", () => {
    const decision = evaluate(
      { city: "Austin", state: "TX", locationType: "onsite" },
      "signup"
    );
    expect(decision.allowed).toBe(true);
  });

  it("AT-8: San Francisco signup is waitlisted", () => {
    const decision = evaluate(
      { city: "San Francisco", state: "CA", locationType: "onsite" },
      "signup"
    );
    expect(decision.allowed).toBe(false);
    expect(decision.messageKey).toBe("signup_waitlist");
  });

  it("AT-10: Albany NY publishes; New York NY does not", () => {
    const albany = evaluate(
      { city: "Albany", state: "NY", locationType: "onsite" },
      "publish_job"
    );
    const nyc = evaluate(
      { city: "New York", state: "NY", locationType: "onsite" },
      "publish_job"
    );
    expect(albany.allowed).toBe(true);
    expect(nyc.allowed).toBe(false);
  });

  it("state NY alone is not NYC", () => {
    const decision = evaluate({
      city: "",
      state: "NY",
      locationType: "onsite",
    });
    expect(decision.reasonCode).toBe("incomplete_location");
  });

  it("NYC ZIP 10001 is hold even with a non-borough city label", () => {
    const decision = evaluate({
      city: "Somewhere",
      state: "NY",
      postalCode: "10001",
      locationType: "onsite",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.matchedPolicyId).toBe("p-nyc");
  });

  it("Buffalo / Rochester / Syracuse NY are allowed", () => {
    for (const city of ["Buffalo", "Rochester", "Syracuse"]) {
      const decision = evaluate({ city, state: "New York", locationType: "onsite" });
      expect(decision.allowed, city).toBe(true);
    }
  });

  it("AT-11: tenant locations_only Raleigh rejects Charlotte with public apply copy", () => {
    const hiringArea: TenantHiringArea = {
      tenantId: "t1",
      mode: "locations_only",
      extraAllowedStates: [],
      locations: [{ city: "Raleigh", state: "NC" }],
    };
    const decision = evaluateServiceArea(
      {
        action: "apply",
        location: { city: "Charlotte", state: "NC", locationType: "onsite" },
      },
      { policies: PHASE1, zipListsByPolicyId: zipLists, hiringArea, enforcePlatformHolds: true, enforceHiringArea: true }
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("outside_hiring_area");
    expect(toPublicServiceAreaDecision(decision)).toEqual({
      allowed: false,
      reasonCode: "location_not_available",
      messageKey: "location_not_enabled",
    });
  });

  it("AT-12: public decision has no layer or policy id", () => {
    const decision = evaluate({ city: "Los Angeles", state: "CA", locationType: "onsite" });
    const publicDecision = toPublicServiceAreaDecision(decision);
    expect(publicDecision).not.toHaveProperty("layer");
    expect(publicDecision).not.toHaveProperty("matchedPolicyId");
  });

  it("AT-13: home address is not evaluated — only confirmed work location", () => {
    const decision = evaluate({
      city: "Raleigh",
      state: "NC",
      locationType: "onsite",
    });
    expect(decision.allowed).toBe(true);
  });

  it("AT-14: remote with empty allowed states cannot publish", () => {
    const decision = evaluate(
      { locationType: "remote", remoteAllowedStates: [] },
      "publish_job"
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("remote_unscoped");
  });

  it("remote publish with CA in the list is hold", () => {
    const decision = evaluate(
      { locationType: "remote", remoteAllowedStates: ["NC", "CA"] },
      "publish_job"
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("platform_hold");
  });

  it("remote publish with NY (state-only) is allowed", () => {
    const decision = evaluate(
      { locationType: "remote", remoteAllowedStates: ["NY", "TX"] },
      "publish_job"
    );
    expect(decision.allowed).toBe(true);
  });

  it("Connecticut city is hold", () => {
    const decision = evaluate({ city: "Hartford", state: "CT", locationType: "hybrid" });
    expect(decision.allowed).toBe(false);
  });

  it("production defaults allow Virginia and do not use facility hiring-area denies", () => {
    const hiringArea: TenantHiringArea = {
      tenantId: "t1",
      mode: "locations_only",
      extraAllowedStates: [],
      locations: [{ city: "Fairbanks", state: "AK" }],
    };
    const decision = evaluateServiceArea(
      {
        action: "publish_job",
        location: { city: "Richmond", state: "VA", locationType: "onsite" },
      },
      { policies: PHASE1, zipListsByPolicyId: zipLists, hiringArea }
    );
    expect(decision.allowed).toBe(true);
    expect(decision.reasonCode).toBe("ok");
  });

  it("production defaults hold CA / IL / CT / NYC work locations", () => {
    const losAngeles = evaluateServiceArea(
      { action: "publish_job", location: { city: "Los Angeles", state: "CA", locationType: "onsite" } },
      { policies: PHASE1, zipListsByPolicyId: zipLists }
    );
    const chicago = evaluateServiceArea(
      { action: "attach_candidate", location: { city: "Chicago", state: "IL", locationType: "onsite" } },
      { policies: PHASE1, zipListsByPolicyId: zipLists }
    );
    const hartford = evaluateServiceArea(
      { action: "signup", location: { city: "Hartford", state: "CT", locationType: "onsite" } },
      { policies: PHASE1, zipListsByPolicyId: zipLists }
    );
    const brooklyn = evaluateServiceArea(
      { action: "apply", location: { city: "Brooklyn", state: "NY", locationType: "onsite" } },
      { policies: PHASE1, zipListsByPolicyId: zipLists }
    );
    expect(losAngeles.allowed).toBe(false);
    expect(losAngeles.reasonCode).toBe("platform_hold");
    expect(chicago.allowed).toBe(false);
    expect(hartford.allowed).toBe(false);
    expect(hartford.messageKey).toBe("signup_waitlist");
    expect(brooklyn.allowed).toBe(false);
  });

  it("holds NYC neighborhoods without ZIP codes", () => {
    for (const city of [
      "Astoria",
      "Flushing",
      "Jamaica",
      "Long Island City",
      "LIC",
      "Williamsburg",
      "Harlem",
      "Manhattan",
      "Queens",
      "Bronx",
      "Staten Island",
      "New York City",
      "NYC",
    ]) {
      const decision = evaluate({ city, state: "NY", locationType: "onsite" });
      expect(decision.allowed, city).toBe(false);
      expect(decision.reasonCode, city).toBe("platform_hold");
    }
  });

  it("blocks unknown city/state values such as asdf, TX", () => {
    const decision = evaluate({ city: "asdf", state: "TX", locationType: "onsite" });
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("unknown_location");
  });

  it("blocks unclassified New York cities that are not NYC or known upstate", () => {
    const decision = evaluate({ city: "NotARealHamlet", state: "NY", locationType: "onsite" });
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("unknown_location");
  });

  it("allows other major allowed-state cities", () => {
    for (const row of [
      { city: "Dallas", state: "TX" },
      { city: "Raleigh", state: "NC" },
      { city: "Seattle", state: "WA" },
      { city: "Miami", state: "FL" },
      { city: "Denver", state: "CO" },
    ]) {
      const decision = evaluate({ ...row, locationType: "onsite" });
      expect(decision.allowed, `${row.city}, ${row.state}`).toBe(true);
    }
  });

  it("blocks missing city or state", () => {
    expect(evaluate({ city: "", state: "TX", locationType: "onsite" }).reasonCode).toBe(
      "incomplete_location"
    );
    expect(evaluate({ city: "Dallas", state: "", locationType: "onsite" }).reasonCode).toBe(
      "incomplete_location"
    );
  });

  it("blocks remote US-wide publish", () => {
    const empty = evaluate({ locationType: "remote", remoteAllowedStates: [] }, "publish_job");
    const usToken = evaluate({ locationType: "remote", remoteAllowedStates: ["US"] }, "publish_job");
    expect(empty.reasonCode).toBe("remote_unscoped");
    expect(usToken.reasonCode).toBe("remote_unscoped");
  });

  it("blocks remote lists that include restricted states", () => {
    expect(
      evaluate({ locationType: "remote", remoteAllowedStates: ["CA"] }, "publish_job").reasonCode
    ).toBe("platform_hold");
    expect(
      evaluate({ locationType: "remote", remoteAllowedStates: ["TX", "IL"] }, "publish_job")
        .reasonCode
    ).toBe("platform_hold");
  });

  it("does not treat relocate as applying unless the flag is true", () => {
    const denied = evaluateServiceArea(
      {
        action: "apply",
        location: {
          city: "Los Angeles",
          state: "CA",
          locationType: "onsite",
          relocateToJobSite: false,
        },
      },
      {
        policies: PHASE1,
        zipListsByPolicyId: zipLists,
        hiringArea: openPlatform,
        enforcePlatformHolds: true,
        jobWorksite: {
          city: "Raleigh",
          state: "NC",
          postalCode: "27601",
          locationType: "onsite",
          remoteAllowedStates: [],
          isPublished: true,
        },
      }
    );
    expect(denied.allowed).toBe(false);
    expect(denied.reasonCode).toBe("platform_hold");
  });
});
