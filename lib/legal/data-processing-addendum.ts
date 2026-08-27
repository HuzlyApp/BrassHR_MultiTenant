import type { LegalDocument } from "./types"

export const DATA_PROCESSING_ADDENDUM: LegalDocument = {
  title: "Data Processing Addendum",
  lastUpdated: null,
  sections: [
    {
      title: "Why This Addendum Exists",
      paragraphs: [
        "The Tenant uses BrassHR to store and run hiring and workforce records - names, contact details, applications, documents, schedules, time punches, and similar HR information. That information belongs to the Tenant's business. ZipStaff Inc. provides the software that holds it.",
        "Privacy laws treat those two roles differently. The Tenant decides why the records exist (hire, schedule, pay export). ZipStaff Inc. handles the records only to run the product. This Data Processing Addendum (the \"DPA\") is the written contract that says that out loud: what ZipStaff may do with Customer Data, who else may touch it, how long it is kept, and what happens if there is a breach.",
        "The public Privacy Policy explains the same ideas to people. This DPA is the customer-to-vendor contract. The Tenant Terms of Service remain the commercial contract. If this DPA and the Tenant Terms conflict on the processing of Customer Data, this DPA controls.",
      ],
    },
    {
      title: "1. Parties and Incorporation",
      paragraphs: [
        "This DPA is between ZipStaff Inc., a North Carolina corporation (\"Processor,\" \"ZipStaff,\" \"we,\" or \"us\"), operator of the BrassHR product, and the organization that holds a BrassHR tenant account (\"Controller\" or \"Tenant\").",
        "This DPA forms part of the Tenant Terms of Service and any order form (together, the \"Agreement\"). It applies when ZipStaff processes Personal Data contained in Customer Data on the Tenant's behalf.",
        "It takes effect when the Tenant accepts the Tenant Terms, signs an order form that incorporates this DPA, or otherwise agrees in writing. No extra signature block is required if the product or order form states that the DPA is included.",
      ],
    },
    {
      title: "2. Definitions",
      paragraphs: [
        "\"Customer Data\" means information the Tenant or its users submit to the Platform about the Tenant's organization, applicants, workers, schedules, time, documents, and related HR activity.",
        "\"Personal Data\" means Customer Data that identifies or relates to an identified or identifiable person.",
        "\"Process\" means any operation on Personal Data, including hosting, storage, access, transmission, deletion, and analysis (including AI-assisted features the Tenant enables).",
        "\"Subprocessor\" means a third party ZipStaff engages to Process Personal Data in order to provide the Platform.",
        "\"Applicable Data Protection Law\" means privacy and data-protection laws that apply to the parties' performance under the Agreement, including, where applicable, U.S. state consumer privacy laws (such as the California Consumer Privacy Act as amended, the Colorado Privacy Act, and similar statutes) and the EU/UK GDPR when EU or UK Personal Data is processed.",
        "\"Security Incident\" means accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to, Personal Data in ZipStaff's possession or control.",
      ],
    },
    {
      title: "3. Roles",
      paragraphs: [
        "For Customer Data processed to provide BrassHR as an HR and workforce product, the Tenant is the Controller (or \"business\") and ZipStaff is the Processor (or \"service provider\").",
        "ZipStaff is an independent Controller only for the limited data described in the Privacy Policy - for example billing contacts, tenant admin accounts we operate, security logs, and product analytics needed to run ZipStaff's own business. That Controller activity is not covered by this DPA.",
        "The Tenant is solely responsible for the lawfulness of its instructions, for giving required notices to applicants and workers, and for the employment decisions it makes using the Platform.",
      ],
    },
    {
      title: "4. Tenant Instructions",
      paragraphs: [
        "ZipStaff will Process Personal Data only:",
        "To provide, secure, maintain, and support the Platform.",
        "To provide AI-assisted features the Tenant enables or that are included in the Tenant's plan as described in the Tenant Terms and Privacy Policy.",
        "As documented in the Agreement, this DPA, and the product configuration the Tenant chooses.",
        "As required by law. If law requires Processing beyond the Tenant's instructions, ZipStaff will tell the Tenant before Processing unless the law prohibits that notice.",
        "The Tenant's configuration of workflows, required documents, users, and integrations constitutes an instruction.",
        "ZipStaff will not sell Personal Data, will not use it for cross-context behavioral advertising, and will not retain, use, or disclose it for any purpose other than the business purposes specified in the Agreement, except as Applicable Data Protection Law allows a service provider / processor to do.",
      ],
    },
    {
      title: "5. Details of Processing (Exhibit A)",
      paragraphs: [
        "Subject matter: hosting and operation of a multi-tenant HR, applicant, scheduling, timekeeping, and document Platform.",
        "Duration: the subscription term plus the post-termination retention period in Section 11 and the Tenant Terms.",
        "Nature and purpose: storage, display, transmission, support, security, reporting, payroll-ready export, and optional AI assistance for matching, parsing, and workflow suggestions.",
        "Types of Personal Data: identity and contact data; employment and application data; documents and credentials; schedule and time data including geolocation when geofenced timekeeping is enabled; communications and notes; account and audit data. Sensitive documents only if the Tenant uploads them.",
        "Data subjects: the Tenant's applicants, workers, emergency contacts, and tenant users.",
      ],
    },
    {
      title: "6. Confidentiality and Personnel",
      paragraphs: [
        "ZipStaff will ensure that people who Process Personal Data are bound by confidentiality and receive training appropriate to HR data. Access is limited to personnel who need it to perform the Agreement.",
      ],
    },
    {
      title: "7. Security",
      paragraphs: [
        "ZipStaff will implement technical and organizational measures appropriate to the risk of an HR SaaS product, including:",
        "Encryption of data in transit (HTTPS) and encryption at rest for stored files.",
        "Tenant scoping of Customer Data and access controls intended to prevent one tenant from reading another tenant's records.",
        "Private, tenant-specific object-storage paths for uploaded documents; access via permission-checked signed URLs.",
        "Authentication, authorization, and audit logs of sensitive actions.",
        "Administrative controls on production access; staging should use anonymized or fake data where practical.",
        "The Tenant is responsible for user permissions inside its tenant, password quality, and devices its staff use.",
      ],
    },
    {
      title: "8. Subprocessors",
      paragraphs: [
        "The Tenant authorizes ZipStaff to use Subprocessors to deliver the Platform. Current categories and known providers are listed in Exhibit B. ZipStaff will impose written data-protection terms on each Subprocessor that are no less protective of Personal Data than this DPA.",
        "ZipStaff will keep Exhibit B current. If ZipStaff adds or replaces a Subprocessor that will Process Personal Data, it will update Exhibit B or give notice to the admin email on the tenant account at least 15 days in advance where practical. The Tenant may object on reasonable data-protection grounds. If the parties cannot resolve the objection, the Tenant may terminate the affected service before the new Subprocessor goes live.",
        "ZipStaff remains responsible to the Tenant for each Subprocessor's performance of obligations ZipStaff has delegated.",
        "Third-party tools the Tenant chooses to connect (for example a background-check vendor the Tenant enables in its own name) are the Tenant's processors, not ZipStaff Subprocessors, unless Exhibit B lists them as ours.",
      ],
    },
    {
      title: "9. Assistance with Requests and Compliance",
      paragraphs: [
        "Taking into account the nature of Processing, ZipStaff will help the Tenant respond to requests from individuals to access, correct, delete, or obtain a copy of Personal Data, by providing product tools where they exist and reasonable cooperation where they do not.",
        "If ZipStaff receives a request that relates to Tenant Customer Data, ZipStaff will direct the individual to the Tenant unless law requires ZipStaff to respond directly.",
        "ZipStaff will provide information reasonably needed for the Tenant's data-protection impact assessments, equal-employment recordkeeping, and regulator inquiries, limited to what ZipStaff actually controls.",
      ],
    },
    {
      title: "10. Security Incidents",
      paragraphs: [
        "ZipStaff will notify the Tenant without undue delay after becoming aware of a Security Incident affecting that Tenant's Personal Data, and in any event within 72 hours where feasible.",
        "The notice will describe, to the extent known: the nature of the incident, the categories of data and subjects affected, likely consequences, and measures taken or proposed. ZipStaff will reasonably cooperate with the Tenant's investigation and any legally required notifications.",
        "ZipStaff's notice is not an admission of fault. The Tenant decides whether and how to notify its applicants, workers, or regulators, unless law requires ZipStaff to notify them directly.",
      ],
    },
    {
      title: "11. Return and Deletion",
      paragraphs: [
        "During the subscription the Tenant may export Customer Data using product export tools.",
        "After the Agreement ends, ZipStaff will make Customer Data available for export for 30 days (or longer if the Tenant Terms say so). After that period ZipStaff will delete or de-identify Customer Data from active systems within a commercially reasonable time.",
        "Copies in backups will expire on the backup cycle. ZipStaff may retain Personal Data only where law requires a hold, to resolve disputes, or to enforce the Agreement, and will isolate that data from production use.",
      ],
    },
    {
      title: "12. Audits",
      paragraphs: [
        "Upon written request no more than once per 12 months (unless a regulator or documented Security Incident requires more), ZipStaff will provide a summary of relevant security practices and, if available, a third-party report (for example SOC 2) under NDA.",
        "If that information is not enough for the Tenant's legal obligations, the Tenant may conduct a remote audit on 30 days' notice, during business hours, without unreasonably disrupting operations. On-site audits require mutual scheduling. The Tenant pays its own costs. ZipStaff may require an NDA and may refuse requests that would expose another tenant's data.",
      ],
    },
    {
      title: "13. International Transfers",
      paragraphs: [
        "The Platform is operated from the United States. If the Tenant submits Personal Data from outside the United States, the Tenant instructs ZipStaff to Process it in the United States.",
        "If EU or UK GDPR applies to a transfer to ZipStaff, the parties will use a lawful transfer mechanism. The Standard Contractual Clauses (processor module) are incorporated by reference when required, with ZipStaff as data importer and the Tenant as data exporter. Annex details are Exhibit A and Exhibit B. Counsel should attach the official SCC text before relying on this clause for EU data.",
      ],
    },
    {
      title: "14. AI Processing",
      paragraphs: [
        "When the Tenant uses AI-assisted features, Personal Data may be sent to Subprocessors listed in Exhibit B solely to generate match suggestions, parse documents, flag missing items, or draft text for human review.",
        "ZipStaff will contractually restrict those providers from using Customer Data to train public, general-purpose models unrelated to operating the Platform, unless the Privacy Policy is updated and the Tenant is given a chance to object or disable the feature.",
        "AI outputs remain Customer Data. They are not employment decisions. The Tenant must apply human review as stated in the Tenant Terms.",
      ],
    },
    {
      title: "15. Liability",
      paragraphs: [
        "Each party's liability under this DPA is subject to the limitations in the Tenant Terms, except that those limitations do not cap a party's liability to the extent Applicable Data Protection Law forbids a cap as to that party's own fine or a data subject's non-waivable rights.",
        "ZipStaff's processing under this DPA is part of the Platform fees. There is no extra DPA fee unless an order form says otherwise.",
      ],
    },
    {
      title: "16. Term",
      paragraphs: [
        "This DPA lasts as long as ZipStaff Processes Personal Data on the Tenant's behalf. Sections that by nature should survive (confidentiality, deletion, liability, governing law) survive.",
      ],
    },
    {
      title: "17. Governing Law",
      paragraphs: [
        "This DPA follows the governing law and venue in the Tenant Terms (North Carolina), except where Applicable Data Protection Law requires otherwise for a specific right or transfer clause.",
      ],
    },
    {
      title: "18. Contact",
      paragraphs: [
        "Privacy and security notices: ZipStaff Inc., hello@zipstaff.com.",
      ],
    },
    {
      title: "Exhibit A - Processing Description",
      paragraphs: [
        "Processor: ZipStaff Inc., North Carolina corporation, operator of BrassHR.",
        "Controller: the Tenant organization named on the BrassHR account.",
        "Services: BrassHR HR, applicant tracking (light), onboarding, documents, credentials, scheduling, timekeeping, PTO, exports, reporting, optional AI assistance.",
        "Frequency: continuous during the subscription.",
        "Retention: subscription term + 30-day export window + backup cycle / legal hold as in Section 11.",
      ],
    },
    {
      title: "Exhibit B - Subprocessor Categories",
      paragraphs: [
        "Replace the examples below with live vendors before publish. Do not list a vendor you do not actually use.",
        "Cloud hosting and database - [e.g. AWS / Google Cloud / Azure / Supabase].",
        "File storage - [e.g. AWS S3 or equivalent], tenant-prefixed paths.",
        "Email delivery - [provider].",
        "SMS delivery - [provider], only if the Tenant sends texts.",
        "E-signature - [e.g. SignEasy or successor], when the Tenant enables e-sign.",
        "Error monitoring and product analytics - [provider], with minimization.",
        "AI model or infrastructure - [provider], only for enabled AI features.",
        "Payment processing - [provider], for Tenant billing (may be Controller data, listed for completeness).",
        "Background-check, payroll, and WhenIWork-style tools the Tenant connects in its own name are Tenant processors unless added here.",
      ],
    },
  ],
}
