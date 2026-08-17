import { RECRUITER_DECISIONS } from "@/lib/jobs/match-analysis/workspace";

export type MockRequirement = {
  id: string;
  text: string;
  type: "Mandatory" | "Preferred";
  status: "Confirmed" | "Needs Verification" | "Blocking";
  action: string;
  evidence: string;
  source: string;
  confidence: number;
};

export type MockScreeningQuestion = {
  id: string;
  question: string;
  why: string;
  related: string;
};

export const AI_ANALYSIS_MOCK = {
  candidateName: "Benjamin Hayes",
  jobTitle: "Security Engineer - DevSecOps",
  matchPercent: 95,
  matchLabel: "Good Match",
  confidencePercent: 55,
  recommendation: "Call & Verify",
  summary:
    "Strong technical fit for Security Engineer – DevSecOps. The résumé documents 9+ years across Security Engineering and DevSecOps, with hands-on SAST, SCA, DAST, IaC scanning, and CI/CD security automation. Education and work authorization are not explicit, and the current-role end date of June 2026 looks like a typo that should be verified before submission.",
  recruiterName: "Zipstaff Admin",
  fullName: "Benjamin Hayes",
  email: "benjamin.hayes@email.com",
  phone: "(415) 555-0148",
  specialty: "Security Engineering",
  location: "San Francisco, CA",
  resumeFileName: "Resumebenjaminhayes.pdf",
  extractedResume: `BENJAMIN HAYES
Security Engineer | DevSecOps
San Francisco, CA  •  benjamin.hayes@email.com  •  (415) 555-0148

SUMMARY
Security engineer with 9+ years designing and operating application-security and DevSecOps programs. Hands-on with SAST, SCA, DAST, IaC scanning, and CI/CD pipeline hardening. Known for automating security workflows that reduced manual review by 10,000 hours annually and supporting 10K concurrent service calls.

EXPERIENCE
Security Engineer — Digital Suits
September 2023 – June 2026
• Built DevSecOps controls across CI/CD, including SAST, SCA, and DAST gates
• Automated security workflows and trained 200+ developers on secure coding
• Partnered with platform teams on HIPAA and PCI DSS control evidence

DevSecOps Engineer — Northline Health
March 2019 – August 2023
• Led application-security reviews for mobile and API products
• Implemented IaC scanning and secret detection in GitHub Actions

Security Analyst — Apex Cloud
June 2016 – February 2019
• Supported vulnerability management, threat modeling, and incident response`,
  requirements: [
    {
      id: "req-1",
      text: "3+ years of experience in Security Engineering, DevSecOps, or a related field.",
      type: "Mandatory",
      status: "Confirmed",
      action: "None",
      evidence:
        "“Security engineer with 9+ years designing and operating application-security and DevSecOps programs.” Current and prior titles include Security Engineer, DevSecOps Engineer, and Security Analyst.",
      source: "Resume",
      confidence: 85,
    },
    {
      id: "req-2",
      text: "Hands-on experience with application security testing and secure SDLC practices.",
      type: "Mandatory",
      status: "Confirmed",
      action: "None",
      evidence:
        "Résumé lists SAST, SCA, DAST, IaC scanning, and CI/CD security gates across multiple roles.",
      source: "Resume",
      confidence: 82,
    },
    {
      id: "req-3",
      text: "Familiarity with SAST, SCA, DAST, and infrastructure-as-code scanning tools.",
      type: "Mandatory",
      status: "Confirmed",
      action: "None",
      evidence:
        "Tools called out explicitly: SAST, SCA, DAST, IaC scanning, secret detection, and GitHub Actions.",
      source: "Resume",
      confidence: 88,
    },
    {
      id: "req-4",
      text: "Bachelor’s degree in Computer Science, Cybersecurity, or a related field.",
      type: "Mandatory",
      status: "Needs Verification",
      action: "Verify education",
      evidence:
        "Education section is not explicit about degree completion. Confirm institution, major, and graduation year.",
      source: "Resume",
      confidence: 40,
    },
    {
      id: "req-5",
      text: "Background in mobile application security and API threat modeling.",
      type: "Preferred",
      status: "Confirmed",
      action: "None",
      evidence:
        "Northline Health role includes application-security reviews for mobile and API products.",
      source: "Resume",
      confidence: 74,
    },
    {
      id: "req-6",
      text: "Relevant security certifications such as CISSP, CISM, or CEH.",
      type: "Preferred",
      status: "Needs Verification",
      action: "Ask in screen",
      evidence: "No CISSP, CISM, or CEH listed on the résumé.",
      source: "Resume",
      confidence: 35,
    },
  ] satisfies MockRequirement[],
  strengths: [
    "Significantly exceeds minimum experience requirement with 9+ years in Security Engineering/DevSecOps roles.",
    "Comprehensive coverage of security scanning tools including SAST, SCA, DAST, and IaC scanning.",
    "Strong automation expertise with quantified outcomes (saved 10,000 manual hours annually).",
    "Extensive enablement experience, including training 200+ developers on secure coding.",
    "Healthcare domain and compliance knowledge spanning HIPAA, PCI DSS, and control evidence.",
  ],
  verificationNeeded: [
    "CRITICAL: Current employment end date listed as June 2026 (future date), suggesting a typo or data-entry error.",
    "Work authorization / sponsorship status is not documented.",
    "Education degree completion is not explicitly confirmed.",
    "On-call support experience is not mentioned.",
    "Missing specific security certifications (CISSP, CISM, CEH).",
    "High quantified metrics should be contextualized (individual vs team contribution).",
  ],
  screeningQuestions: [
    {
      id: "q1",
      question:
        "Your résumé shows your current role at Digital Suits ending in June 2026, which is a future date. Can you clarify your actual end date or whether this role is still current?",
      why: "A future-dated end date can block submission until employment timeline is confirmed.",
      related: "Current employment dates at Digital Suits",
    },
    {
      id: "q2",
      question:
        "Are you authorized to work in the United States, and would you require sponsorship now or in the future?",
      why: "Work authorization is required before presenting the candidate to the client.",
      related: "Work authorization / sponsorship status",
    },
    {
      id: "q3",
      question:
        "Did you complete a bachelor’s degree? If so, please confirm the institution, major, and graduation year.",
      why: "Degree completion is listed as a mandatory qualification and is not explicit on the résumé.",
      related: "Bachelor’s degree requirement",
    },
    {
      id: "q4",
      question:
        "This role may include on-call support. Have you supported production incidents or on-call rotations, and how recently?",
      why: "On-call experience is expected for DevSecOps coverage and is not mentioned.",
      related: "On-call / production support",
    },
    {
      id: "q5",
      question:
        "You mention impressive quantified results like reducing manual workload by 10,000 hours annually and processing 10K concurrent service calls. Can you walk me through one of these achievements and describe your specific role versus team contributions?",
      why: "Contextualize high-impact metrics to understand scope, scale, and individual contribution for accurate client representation.",
      related: "Experience automating security workflows in a DevSecOps environment.",
    },
  ] satisfies MockScreeningQuestion[],
  missingInformation: [
    "Work authorization and sponsorship status not documented",
    "Security certifications not listed (CISSP, CISM, CEH)",
    "Compensation expectations not provided",
    "Education degree completion not explicitly confirmed",
  ],
  jobDescriptionConflicts: [] as string[],
  resumeConflicts: [
    "Current role end date is listed as June 2026 (future date), likely a typo.",
    "Tenure claims do not perfectly match the calculated timeline across all roles.",
  ],
  experienceCalculations: [
    "Security Engineer at Digital Suits: September 2023 to June 2026 = 2 years 9 months",
    "DevSecOps Engineer at Northline Health: March 2019 to August 2023 = 4 years 5 months",
    "Security Analyst at Apex Cloud: June 2016 to February 2019 = 2 years 8 months",
    "CRITICAL: Future-dated end date requires verification before totaling current-role tenure.",
  ],
  scoreAdjustments: [
    "Recomputed mandatory_requirements_score from evidence: 90 → 88",
    "Confidence reduced due to missing authorization and education confirmation: 70 → 55",
  ],
  resumeCompleteness: "Moderate",
  jobCompleteness: "High",
  analysisHistory: {
    scoreLabel: "85% - Strong Match",
    timestamp: "8/6/2026 • 11:45:57 PM",
  },
  decisionOptions: RECRUITER_DECISIONS,
} as const;
