import type { LegalDocument } from "./types"

export const PRIVACY_POLICY: LegalDocument = {
  title: "Privacy Policy",
  lastUpdated: null,
  sections: [
    {
      title: "1. Who We Are",
      paragraphs: [
        "This Privacy Policy describes how ZipStaff Inc., a North Carolina corporation (\"ZipStaff,\" \"we,\" \"us,\" or \"our\"), collects, uses, shares, and protects personal information in connection with the BrassHR platform, websites, mobile applications, applicant portals, and related services (the \"Platform\").",
        "BrassHR is a product name and brand. It is not, as of the date of this Policy, a separate registered legal entity. The Platform is owned and operated by ZipStaff Inc.",
        "Contact: ZipStaff Inc., hello@zipstaff.com.",
      ],
    },
    {
      title: "2. Who This Policy Covers",
      paragraphs: [
        "This single Policy covers the people who use BrassHR:",
        "• Applicants and candidates who create an account or apply for a job through a BrassHR applicant portal.",
        "• Workers and employees whose employer uses BrassHR for profiles, scheduling, timekeeping, PTO, documents, or onboarding.",
        "• Tenant users - the employer's recruiters, managers, HR admins, and other staff who log into BrassHR to run that organization's account.",
        "• Website visitors who browse brassHR.com or related marketing pages without an account.",
      ],
    },
    {
      title: '3. Who Is the "Controller"',
      paragraphs: [
        "Privacy law asks who decides why personal information is processed. For BrassHR that answer depends on the situation.",
        "When ZipStaff Inc. is the controller We decide the purposes for: Platform accounts we operate; billing and subscription records for a tenant; product security, fraud prevention, and audit logs; website analytics and marketing pages; support tickets sent to hello@zipstaff.com; and improving BrassHR features, including AI tools we provide as part of the product.",
        "BrassHR · a product of ZipStaff Inc. · Privacy Policy When the Employer is the controller and ZipStaff Inc. is the processor The organization that holds the BrassHR tenant account (the \"Employer\") decides what jobs to post, what documents to require, whom to interview or hire, how long to keep employee files, and how to run scheduling, timekeeping, and PTO. In those cases ZipStaff Inc. processes personal information on the Employer's instructions to provide the software.",
        "If you are an applicant or worker, many questions about \"why was I rejected,\" \"delete my employee file,\" or \"who sees my timesheet\" should go first to the Employer. We will help where we can and where the law requires us to.",
      ],
    },
    {
      title: "4. Personal Information We Collect",
      paragraphs: [
        "Applicants",
        "• Identity and contact: name, email, phone, address if provided.",
        "• Account credentials and login activity.",
        "• Work history, education, resume or CV, skills, questionnaires, and assessments.",
        "• Licenses, certifications, expiration dates, and uploaded documents (which may include ID or work- authorization files if the Employer requests them).",
        "• Application status, recruiter notes, call logs, and messages sent through the Platform.",
        "• AI match scores, rankings, parsed profile fields, and similar assistance outputs when those features are enabled.",
        "Workers",
        "• The applicant fields above that carry into the employee record.",
        "• Job title, location or facility, department, employment type, hire date, and status.",
        "• Schedule, shifts, clock-in/out times, geolocation used for geofenced timekeeping, breaks, timesheets, and corrections.",
        "• PTO balances, leave requests, and approvals.",
        "• Emergency contacts and notes the Employer stores.",
        "• Payroll-ready hour totals and export files the Employer generates. BrassHR does not run payroll in the current product scope.",
        "Tenant users",
        "• Name, work email, role, tenant membership, and permissions.",
        "• Login, support, and audit activity.",
        "• Billing contact and subscription information for the tenant account.",
        "Information collected automatically",
        "• Device, browser, app version, IP address, approximate location derived from IP, pages viewed, and cookies or similar technologies on marketing and product sites.",
        "• Mobile time-clock location when a worker clocks in or out and the Employer has enabled geofencing.",
        "BrassHR · a product of ZipStaff Inc. · Privacy Policy Information we do not want by default Do not upload a full Social Security number, bank account number, or medical diagnosis unless the Employer has a lawful need and the Platform field is designed for that data. We ask Employers to collect the minimum required.",
        "Where sensitive documents are uploaded, they are stored for the Employer's HR file and treated as confidential.",
      ],
    },
    {
      title: "5. How We Use Personal Information",
      paragraphs: [
        "We use personal information to:",
        "• Create and secure accounts, authenticate users, and provide the features the tenant has enabled.",
        "• Deliver applications to the Employer and let that Employer's authorized staff review them.",
        "• Run onboarding checklists, document collection, e-sign flows, credential tracking, scheduling, timekeeping, PTO, and timesheet review.",
        "• Provide AI-assisted matching, parsing, summaries, missing-item flags, and similar tools that complement human work, as described in the Applicant Terms and in Section 8 below.",
        "• Send operational messages (application updates, document requests, schedule notices). Marketing messages are sent only where permitted, and you may opt out of marketing.",
        "• Maintain audit logs, prevent fraud and abuse, debug the product, and meet legal obligations.",
        "• Improve the Platform, including quality of matching and document-processing features.",
        "• Process tenant subscriptions and provide customer support.",
      ],
    },
    {
      title: "6. How We Share Personal Information",
      paragraphs: [
        "We do not sell personal information.",
        "We share personal information only as follows:",
        "• With the Employer tenant you applied to or work for, and that Employer's authorized users.",
        "• With service providers that help us operate the Platform - hosting, file storage, email and SMS delivery, e-signature, background-check vendors the Employer enables, customer support tools, analytics, and AI model or infrastructure providers. These parties are allowed to use the data only to perform services for us or the Employer.",
        "• With the Employer's payroll or other systems when the Employer exports hours or onboarding data.",
        "• If required by law, legal process, or to protect rights, safety, or security.",
        "• In connection with a merger, financing, or sale of ZipStaff Inc. or the BrassHR product line, including a future assignment to a dedicated BrassHR legal entity. We will require the successor to honor this Policy or give notice of changes.",
        "Applying to Employer A does not share your profile with Employer B unless you apply there too, or you later opt into a shared talent-pool feature that we disclose at that time.",
        "BrassHR · a product of ZipStaff Inc. · Privacy Policy",
      ],
    },
    {
      title: "7. What Is Different by Role",
      paragraphs: [
        "Applicants Your application is a submission to the Employer. That Employer sees what you upload and may keep it under its record-retention rules even if you later close your BrassHR login. AI matching, if enabled, may rank or suggest your profile to that Employer's recruiters. A score is not a hiring decision.",
        "Workers Your Employer uses BrassHR as an HR and workforce tool. Schedules, punches, documents, and PTO are visible to the managers and HR staff the Employer authorizes. Location is collected for clock-in/out only when geofencing is on. Ask your Employer about workplace monitoring policies that go beyond this Policy.",
        "Tenant users and Employers You must use BrassHR only for lawful HR and hiring purposes. You must give your applicants and employees any notices your state or sector requires. You must not use the Platform to collect data you do not need. Our customer contract and Data Processing Addendum (when executed) control how we process data for you. This Policy does not replace that contract.",
      ],
    },
    {
      title: "8. Artificial Intelligence",
      paragraphs: [
        "BrassHR uses AI and automated tools to complement human tasks. Examples include matching candidates to jobs, parsing resumes, suggesting next steps, flagging missing documents or expired credentials, and drafting text for a person to review.",
        "AI output can be wrong. It does not hire, reject, or discipline anyone by itself. Employers are expected to use human review for employment decisions.",
        "We may send information you submit to third-party AI providers solely to run and improve these product features, under contracts that restrict their use of the data. We do not use applicant or worker content to train public, general-purpose AI models that are unrelated to operating the Platform, unless we update this Policy and, where required, obtain additional consent.",
        "If you believe an AI-assisted result about you is inaccurate, contact the Employer or hello@zipstaff.com so a person can review it.",
      ],
    },
    {
      title: "9. Cookies and Similar Technologies",
      paragraphs: [
        "We use necessary cookies to keep you signed in and keep the site secure. We may use analytics cookies on marketing pages to understand traffic. You can control cookies in your browser. The product application may not function if required cookies are blocked.",
      ],
    },
    {
      title: "10. Retention",
      paragraphs: [
        "We keep personal information for as long as the account is active and as long as needed to provide the Platform, resolve disputes, enforce agreements, and meet legal, tax, and audit requirements.",
        "BrassHR · a product of ZipStaff Inc. · Privacy Policy Employer-controlled HR records (applications, employee files, timesheets, credentials) are retained according to that Employer's settings and legal obligations. Closing your login does not automatically erase the Employer's copy.",
        "When a tenant ends its BrassHR subscription, we retain or delete tenant data as described in the customer agreement, then delete or de-identify remaining copies from active systems within a commercially reasonable period unless law requires a longer hold.",
      ],
    },
    {
      title: "11. Security",
      paragraphs: [
        "We use administrative, technical, and physical safeguards appropriate to an HR platform, including encryption in transit, encryption at rest for stored files, tenant isolation (including database tenant scoping and access controls), private file paths per tenant, and audit logging of sensitive actions.",
        "No method of transmission or storage is completely secure. You are responsible for keeping your password confidential.",
      ],
    },
    {
      title: "12. Your Rights",
      paragraphs: [
        "Depending on where you live (for example, certain U.S. state privacy laws), you may have the right to request access, correction, deletion, a copy of your data, or to opt out of certain processing. You may also appeal a denied request where the law provides an appeal.",
        "How to submit a request:",
        "• If the request is about a job application, employee file, schedule, or timesheet, contact the Employer first. We will support the Employer in responding.",
        "• If the request is about a ZipStaff / BrassHR account we control, marketing, or this website, email hello@zipstaff.com.",
        "We will not discriminate against you for exercising privacy rights. We may need to verify your identity. We may decline a request when an exception applies - for example, when the Employer must keep a record for payroll, immigration, equal-employment, or litigation reasons.",
        "Do not use this Policy as your only California, Colorado, or similar state-specific notice if counsel later requires an addendum. Those addenda can be attached without splitting this Policy into three products.",
      ],
    },
    {
      title: "13. Children",
      paragraphs: [
        "The Platform is not directed to children under 13. We do not knowingly collect personal information from children under 13. Applicants and workers must meet the minimum working age stated in the Applicant Terms. If you believe we have collected information from a child under 13, email hello@zipstaff.com.",
      ],
    },
    {
      title: "14. International Users",
      paragraphs: [
        "The Platform is operated from the United States. If you access it from another country, your information will be processed in the United States, which may have different data-protection rules than your home country.",
        "BrassHR · a product of ZipStaff Inc. · Privacy Policy",
      ],
    },
    {
      title: "15. Changes",
      paragraphs: [
        "We may update this Policy from time to time. The \"Last updated\" date will change when we do. If a change is material, we will provide notice through the Platform or by email where reasonably practicable.",
      ],
    },
    {
      title: "16. Contact",
      paragraphs: [
        "ZipStaff Inc.",
        "Email: hello@zipstaff.com Questions about a specific application, job, timesheet, or employee file: contact the Employer whose name appears on that record.",
      ],
    },
  ],
}
