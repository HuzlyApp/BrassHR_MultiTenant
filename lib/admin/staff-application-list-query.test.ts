import { describe, expect, it } from "vitest";
import {
  appliedDateWindow,
  bestPipelineStatusId,
  matchScoreBounds,
  tabCountsFromBuckets,
} from "@/lib/admin/staff-application-list-query";

const options = [
  { id: "new-id", systemKey: "new" },
  { id: "reviewing-id", systemKey: "reviewing" },
  { id: "archived-id", systemKey: "archived" },
];

describe("tabCountsFromBuckets", () => {
  it("sums status ids and keeps all as the bucket total", () => {
    const counts = tabCountsFromBuckets(
      [
        { statusId: "new-id", systemKey: "new", status: "new", pipeline: "new", count: 4 },
        {
          statusId: "reviewing-id",
          systemKey: "reviewing",
          status: "reviewing",
          pipeline: "reviewing",
          count: 6,
        },
        {
          statusId: "archived-id",
          systemKey: "archived",
          status: "archived",
          pipeline: "archived",
          count: 1,
        },
      ],
      options
    );
    expect(counts.all).toBe(11);
    expect(counts["new-id"]).toBe(4);
    expect(counts["reviewing-id"]).toBe(6);
    expect(counts["archived-id"]).toBe(1);
  });
});

describe("bestPipelineStatusId", () => {
  it("picks the in-process status with the most rows and skips MSP", () => {
    const id = bestPipelineStatusId(
      [
        {
          statusId: "reviewing-id",
          systemKey: "reviewing",
          status: "reviewing",
          pipeline: "reviewing",
          atMsp: false,
          count: 2,
        },
        {
          statusId: "msp-id",
          systemKey: "at_msp",
          status: "reviewing",
          pipeline: "reviewing",
          atMsp: true,
          count: 9,
        },
        {
          statusId: "interview-id",
          systemKey: "interviewing",
          status: "interviewing",
          pipeline: "interviewing",
          count: 5,
        },
      ],
      "in_process"
    );
    expect(id).toBe("interview-id");
  });
});

describe("matchScoreBounds", () => {
  it("maps legacy and range filters", () => {
    expect(matchScoreBounds("90_plus")).toMatchObject({ apply: true, min: 90, max: null });
    expect(matchScoreBounds("80_90")).toMatchObject({
      apply: true,
      min: 80,
      max: 90,
      maxInclusive: false,
    });
    expect(matchScoreBounds("no_score")).toMatchObject({ apply: true, noScore: true });
    expect(matchScoreBounds("custom:70-85")).toMatchObject({
      apply: true,
      min: 70,
      max: 85,
      maxInclusive: true,
    });
    expect(matchScoreBounds("")).toMatchObject({ apply: false });
  });
});

describe("appliedDateWindow", () => {
  it("uses the browser offset for the start of today", () => {
    const now = new Date("2026-09-28T04:00:00.000Z");
    const window = appliedDateWindow("today", -480, now);
    expect(window.from).toBe("2026-09-27T16:00:00.000Z");
    expect(window.before).toBeNull();
  });
});
