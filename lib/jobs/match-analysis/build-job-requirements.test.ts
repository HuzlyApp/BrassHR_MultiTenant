import { describe, expect, it } from "vitest";
import {
  buildFullJobDescriptionText,
  buildStructuredJobRequirements,
  extractQualificationSectionsFromDescription,
} from "./build-job-requirements";
import { jobProfileFromWorkspace } from "../candidate-import-match";
import { buildMatchAnalysisUserPrompt } from "./prompts";

const ZIPSTAFF_IT_PM_HTML = `<p><strong>Job Title:</strong> IT Project Manager<br><strong>Location:</strong> Richardson, TX (On-site)<br><strong>Employment Type:</strong> Contract (W2 through ZipStaff — No C2C or 1099)</p><p>About the Opportunity</p><p>ZipStaff is seeking an <strong>IT Project Manager</strong> to lead implementation of customer-facing technology solutions at a leading global manufacturer of climate-control and HVAC products.</p><p>You will own the project lifecycle from planning through deployment — schedule, budget, risk, and stakeholder communication. This is an on-site delivery role in Richardson, TX. Coordinators who have only tracked status, or PMs who have never taken a customer-facing system live, will not be a fit.</p><p>What You’ll Do</p><ul><li><p>Lead implementation of <strong>customer-facing IT solutions</strong> from planning through final deployment</p></li><li><p>Own project lifecycle activities: scope, plan, schedule, resources, and go-live readiness</p></li><li><p>Proactively identify and mitigate project risks and issues</p></li><li><p>Monitor <strong>budgets and schedules</strong> and keep delivery on time and within budget</p></li><li><p>Provide regular progress updates to stakeholders and leadership</p></li><li><p>Coordinate cross-functional teams through implementation and deployment</p></li><li><p>Drive issue resolution and keep customer-facing delivery moving</p></li></ul><p>Required Qualifications</p><ul><li><p><strong>5+ years</strong> of IT project management experience delivering systems from plan through production deployment</p></li><li><p>Proven experience implementing <strong>customer-facing</strong> technology solutions (not internal-only tooling)</p></li><li><p>Demonstrated ownership of <strong>schedule, budget, and risk</strong> across the project lifecycle</p></li><li><p>Strong stakeholder communication and status-reporting skills</p></li><li><p>Ability to work <strong>100% on-site in Richardson, TX</strong></p></li><li><p>Must be legally authorized to work in the United States without sponsorship now or in the future</p></li></ul><p>Preferred Qualifications</p><ul><li><p>PMP, CAPM, or equivalent project-management certification</p></li><li><p>Experience in manufacturing, industrial, HVAC, or distribution environments</p></li><li><p>Experience delivering CRM, customer-portal, or other customer-engagement platforms</p></li></ul>`;

const EMPTY_CACHE = {
  location: "Richardson, Texas",
  specialty: null,
  requiredLicenses: [],
  educationRequirements: [],
  mandatoryRequirements: [],
  preferredRequirements: [],
  requiredCertifications: [],
  requiredYearsExperience: "7 yrs",
};

describe("extractQualificationSectionsFromDescription", () => {
  it("reads Required and Preferred lists from Zipstaff-style HTML descriptions", () => {
    const extracted = extractQualificationSectionsFromDescription(ZIPSTAFF_IT_PM_HTML);

    expect(extracted.mandatory).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/5\+\s*years/i),
        expect.stringMatching(/customer-facing/i),
        expect.stringMatching(/schedule, budget, and risk/i),
        expect.stringMatching(/on-site in Richardson/i),
        expect.stringMatching(/without sponsorship/i),
      ])
    );
    expect(extracted.mandatory).toHaveLength(6);
    expect(extracted.preferred).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/PMP, CAPM/i),
        expect.stringMatching(/manufacturing/i),
        expect.stringMatching(/CRM/i),
      ])
    );
    expect(extracted.preferred).toHaveLength(3);
    expect(extracted.mandatory.join(" ")).not.toMatch(/Lead implementation of/i);
  });
});

describe("buildStructuredJobRequirements", () => {
  it("does not treat location/years-only cache as complete when quals live in the description", () => {
    const structured = buildStructuredJobRequirements({
      public_title: "IT Project Manager",
      qualifications: null,
      special_requirements: null,
      required_credentials: [],
      years_of_experience: "7 yrs",
      years_experience_required: 7,
      location: "Richardson, Texas",
      public_description: ZIPSTAFF_IT_PM_HTML,
      structured_requirements: EMPTY_CACHE,
    });

    expect(structured.mandatoryRequirements.length).toBe(6);
    expect(structured.preferredRequirements.length).toBe(3);
    expect(structured.requiredYearsExperience).toBe("7 yrs");
    expect(structured.location).toBe("Richardson, Texas");
  });

  it("keeps a cache that already has required or preferred lists", () => {
    const structured = buildStructuredJobRequirements({
      public_title: "IT Project Manager",
      public_description: ZIPSTAFF_IT_PM_HTML,
      qualifications: null,
      structured_requirements: {
        ...EMPTY_CACHE,
        mandatoryRequirements: ["Cached mandatory"],
        preferredRequirements: ["Cached preferred"],
      },
    });

    expect(structured.mandatoryRequirements).toEqual(["Cached mandatory"]);
    expect(structured.preferredRequirements).toEqual(["Cached preferred"]);
  });

  it("still uses the dedicated qualifications field when present", () => {
    const structured = buildStructuredJobRequirements({
      qualifications: "Required\nBLS\nACLS\nPreferred\nCCRN",
      public_description: null,
    });

    expect(structured.mandatoryRequirements).toEqual(["BLS", "ACLS"]);
    expect(structured.preferredRequirements).toEqual(["CCRN"]);
  });
});

describe("jobProfileFromWorkspace for description-only quals", () => {
  it("surfaces required skills from HTML job descriptions", () => {
    const profile = jobProfileFromWorkspace({
      public_title: "IT Project Manager",
      public_description: ZIPSTAFF_IT_PM_HTML,
      qualifications: null,
      location: "Richardson, Texas",
      years_of_experience: "7 yrs",
      structured_requirements: EMPTY_CACHE,
    });

    expect(profile.requiredSkills.length).toBeGreaterThan(0);
    expect(profile.preferredSkills.some((skill) => /PMP/i.test(skill))).toBe(true);
  });
});

describe("match analysis prompt when structured lists were empty", () => {
  it("tells the model to extract qualifications from the job description", () => {
    const prompt = buildMatchAnalysisUserPrompt({
      jobId: "job-1",
      jobTitle: "IT Project Manager",
      structured: {
        mandatoryRequirements: [],
        preferredRequirements: [],
        requiredLicenses: [],
        requiredCertifications: [],
        educationRequirements: [],
      },
      fullJobDescription: "Required Qualifications\n5+ years IT PM",
      resumeText: "David Kabelele",
    });

    expect(prompt).toContain("extract every Required Qualifications bullet from the full job description");
    expect(prompt).not.toContain("for reference only; requirements above are authoritative");
  });
});

describe("Grant Thornton / Zipstaff Data Engineer HTML", () => {
  const GRANT_THORNTON_DATA_ENGINEER_HTML = `<p><strong>Job Title:</strong> Data Engineer – Informatica IDMC, Snowflake &amp; Azure<br><strong>Location:</strong> Remote (U.S.)<br><strong>Employment Type:</strong> Contract (W2 through ZipStaff — No C2C or 1099)</p><p></p><p><strong>About the Opportunity</strong></p><p>ZipStaff is seeking a <strong>hands-on Data Engineer</strong> to design and build enterprise data pipelines for a leading professional-services firm (audit, tax, and advisory).</p><p>This role sits in a firm-wide Data &amp; Analytics function focused on accurate reporting and actionable insights. You will <strong>develop and manage data pipelines</strong> — not oversee a team that does the work. Collaboration includes teams in the U.S. and Ireland, so schedule flexibility across time zones is required.</p><p></p><p><strong>What You’ll Do:</strong></p><ul><li><p>Design, develop, and maintain data pipelines for storage, processing, and enterprise delivery.</p></li><li><p>Extract data from multiple sources, transform it, and load it into target platforms.</p></li></ul><p></p><p><strong>Required Qualifications:</strong></p><ul><li><p><strong>8+ years</strong> of hands-on data engineering (data modeling, ETL/ELT, integration, MDM/entity management, data quality, warehousing, analytics/BI, and governance).</p></li><li><p><strong>Hands-on pipeline development</strong> — not oversight, support-only, or people-management of data teams.</p></li><li><p>Extensive experience with <strong>Informatica IDMC</strong> (CIH, DIH, CDGC, MDM, Data Quality).</p></li><li><p>Extensive experience with <strong>Snowflake.</strong></p></li><li><p>Extensive Microsoft data-stack experience: <strong>SQL Server, Synapse, Azure Data Factory, Azure Databricks.</strong></p></li><li><p>Proficiency in <strong>SQL</strong> plus <strong>C#, Python, and/or Java.</strong></p></li><li><p>Bachelor’s degree in Computer Science, Data Science, Software Engineering, Information Systems, or equivalent.</p></li><li><p>Ability to work <strong>100% remote</strong> and coordinate with U.S. and Ireland teams (schedule flexibility required).</p></li><li><p>Must be a <strong>U.S. Citizen or Green Card holder</strong> (no sponsorship now or in the future).</p></li></ul><p></p><p><strong>Preferred Qualifications:</strong></p><ul><li><p>Azure / Snowflake / Informatica certifications.</p></li><li><p>Power BI, Microsoft Fabric, Cosmos DB, or HDInsight.</p></li><li><p>Professional-services, accounting, client-service, or managed-services background.</p></li></ul>`;

  it("extracts required and preferred quals even when cache only has location and years", () => {
    const structured = buildStructuredJobRequirements({
      public_title: "Data Engineer",
      qualifications: null,
      special_requirements: null,
      required_credentials: [],
      years_of_experience: "7 yrs",
      years_experience_required: 7,
      location: "Carrboro, North Carolina",
      public_description: GRANT_THORNTON_DATA_ENGINEER_HTML,
      structured_requirements: {
        location: "Carrboro, North Carolina",
        specialty: null,
        requiredLicenses: [],
        educationRequirements: [],
        mandatoryRequirements: [],
        preferredRequirements: [],
        requiredCertifications: [],
        requiredYearsExperience: "7 yrs",
      },
    });

    expect(structured.mandatoryRequirements.length).toBe(9);
    expect(structured.preferredRequirements.length).toBe(3);
    expect(structured.mandatoryRequirements.join(" ")).toMatch(/Informatica IDMC/i);
    expect(structured.mandatoryRequirements.join(" ")).toMatch(/Snowflake/i);
    expect(structured.mandatoryRequirements.join(" ")).toMatch(/Azure Data Factory/i);
    expect(structured.mandatoryRequirements.join(" ")).not.toMatch(
      /Design, develop, and maintain data pipelines/i
    );
    expect(structured.preferredRequirements.join(" ")).toMatch(/Power BI/i);
  });
});

describe("buildFullJobDescriptionText", () => {
  it("strips HTML so analysis sees qualification headings as plain text", () => {
    const text = buildFullJobDescriptionText({
      public_title: "IT Project Manager",
      public_description: ZIPSTAFF_IT_PM_HTML,
    });

    expect(text).toContain("Required Qualifications");
    expect(text).toContain("Preferred Qualifications");
    expect(text).not.toMatch(/<\/?(p|ul|li|strong)>/i);
  });
});
