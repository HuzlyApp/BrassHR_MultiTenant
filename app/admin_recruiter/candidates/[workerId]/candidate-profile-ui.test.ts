import { describe, expect, it } from "vitest";
import {
  formatProfileActivityDay,
  formatProfileActivityTime,
  groupProfileActivityByDay,
  profileActivityKind,
  profileActivityRangeBounds,
  filterProfileActivityByRange,
  splitProfessionalSummaryBlocks,
} from "./candidate-profile-ui";

describe("candidate profile activity helpers", () => {
  it("formats time and groups items by day", () => {
    const now = new Date("2026-08-19T18:00:00");
    expect(formatProfileActivityTime("2026-08-19T14:05:00")).toMatch(/2:05|14:05/);
    expect(formatProfileActivityDay("2026-08-19T14:05:00", now)).toBe("Today");
    expect(formatProfileActivityDay("2026-08-18T09:00:00", now)).toBe("Yesterday");

    const groups = groupProfileActivityByDay(
      [
        { at: "2026-08-19T14:05:00", id: "1" },
        { at: "2026-08-19T10:00:00", id: "2" },
        { at: "2026-08-18T09:00:00", id: "3" },
      ],
      now
    );
    expect(groups.map((group) => group.day)).toEqual(["Today", "Yesterday"]);
    expect(groups[0].items).toHaveLength(2);
  });

  it("classifies activity kinds for icons", () => {
    expect(profileActivityKind("Viewed profile")).toBe("view");
    expect(profileActivityKind("Applied to CNA - 09")).toBe("job");
    expect(profileActivityKind("Resume uploaded")).toBe("document");
  });
});

describe("profile activity date ranges", () => {
  const now = new Date("2026-08-19T18:00:00");

  it("defaults last 3 days from the start of two days ago through today", () => {
    const bounds = profileActivityRangeBounds("last_3_days", now);
    expect(bounds?.start.getFullYear()).toBe(2026);
    expect(bounds?.start.getMonth()).toBe(7);
    expect(bounds?.start.getDate()).toBe(17);
    expect(bounds?.end.getDate()).toBe(19);
    expect(bounds?.end.getHours()).toBe(23);
  });

  it("uses the previous Monday–Sunday for last week", () => {
    const bounds = profileActivityRangeBounds("last_week", now);
    expect(bounds?.start.getFullYear()).toBe(2026);
    expect(bounds?.start.getMonth()).toBe(7);
    expect(bounds?.start.getDate()).toBe(10);
    expect(bounds?.end.getDate()).toBe(16);
  });

  it("uses the previous calendar month and year", () => {
    const month = profileActivityRangeBounds("last_month", now);
    expect(month?.start.getMonth()).toBe(6);
    expect(month?.start.getDate()).toBe(1);
    expect(month?.end.getMonth()).toBe(6);
    expect(month?.end.getDate()).toBe(31);

    const year = profileActivityRangeBounds("last_year", now);
    expect(year?.start.getFullYear()).toBe(2025);
    expect(year?.end.getFullYear()).toBe(2025);
  });

  it("filters items into a custom date range and swaps reversed dates", () => {
    const items = [
      { id: "in", at: "2026-08-12T12:00:00" },
      { id: "out", at: "2026-08-01T12:00:00" },
    ];
    const filtered = filterProfileActivityByRange(items, "custom", now, "2026-08-18", "2026-08-10");
    expect(filtered.map((item) => item.id)).toEqual(["in"]);
  });

  it("returns no custom range until both dates are set", () => {
    expect(profileActivityRangeBounds("custom", now, "2026-08-10", "")).toBeNull();
    expect(filterProfileActivityByRange([{ at: "2026-08-12T12:00:00" }], "custom", now, "2026-08-10", "")).toEqual([]);
  });
});

describe("professional summary blocks", () => {
  it("treats uppercase resume sections as headings", () => {
    const blocks = splitProfessionalSummaryBlocks(
      "Senior DevSecOps Engineer\n\nPROFESSIONAL SUMMARY:\nLeads cloud security.\n\nCERTIFICATIONS:\nAWS Security Specialty"
    );
    expect(blocks.map((block) => block.kind)).toEqual(["name", "heading", "body", "heading", "body"]);
    expect(blocks[1].text).toBe("PROFESSIONAL SUMMARY:");
  });

  it("formats contact lines and work history with hierarchy", () => {
    const blocks = splitProfessionalSummaryBlocks(
      [
        "Hailey Sparks",
        "Danville, VA",
        "haileysparks36_udv@indeedemail.com",
        "+1 434 483 3551",
        "Professional Summary",
        "I am a dedicated and reliable individual.",
        "Work Experience",
        "CNA - Certified Nursing Assistant",
        "Piney Forest Health & Rehabilitation Center",
        "April 2025 to Present",
        "Server",
        "Buffalo wild wings",
        "September 2024 to May 2025",
        "Serve the customer discreetly.",
        "#readytowork",
      ].join("\n")
    );
    expect(blocks.map((block) => `${block.kind}:${block.text}`)).toEqual([
      "name:Hailey Sparks",
      "location:Danville, VA",
      "email:haileysparks36_udv@indeedemail.com",
      "phone:+1 434 483 3551",
      "heading:Professional Summary",
      "body:I am a dedicated and reliable individual.",
      "heading:Work Experience",
      "jobTitle:CNA - Certified Nursing Assistant",
      "company:Piney Forest Health & Rehabilitation Center",
      "date:April 2025 to Present",
      "jobTitle:Server",
      "company:Buffalo wild wings",
      "date:September 2024 to May 2025",
      "body:Serve the customer discreetly.",
      "tag:#readytowork",
    ]);
  });
});
