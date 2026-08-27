import type { LegalDocument } from "./types"

export const TENANT_TERMS: LegalDocument = {
  title: "Tenant Terms of Service",
  lastUpdated: null,
  sections: [
    {
      title: "1. Agreement",
      paragraphs: [
        "These Tenant Terms of Service (the \"Terms\") are a contract between ZipStaff Inc., a North Carolina corporation (\"ZipStaff,\" \"we,\" \"us,\" or \"our\"), and the company, organization, church, nonprofit, staffing firm, or other entity that creates a BrassHR tenant account (the \"Tenant,\" \"you,\" or \"your\").",
        "BrassHR is a product name and brand. It is not, as of the date of these Terms, a separate registered legal entity. The BrassHR platform, websites, mobile applications, and related services (the \"Platform\") are owned and operated by ZipStaff Inc.",
        "By creating a tenant account, clicking \"I Agree,\" starting a trial, paying an invoice, or using the Platform as an employer customer, you agree to these Terms, the BrassHR Privacy Policy, and any order form or plan page that states your fees and limits.",
        "If you accept these Terms on behalf of an organization, you represent that you have authority to bind that organization. If you do not have that authority, or you do not agree, do not create a tenant account.",
        "These Terms do not govern an individual who only applies for a job or clocks in as a worker. Those people are covered by the Applicant Terms and the Privacy Policy.",
      ],
    },
    {
      title: "2. The Service",
      paragraphs: [
        "BrassHR is a multi-tenant HR and workforce operations product. Depending on the plan you buy and the features you enable, it may include employee and applicant records, document collection, onboarding checklists, credential tracking, scheduling, geofenced timekeeping, PTO, timesheet review, payroll-ready exports, reporting, branding, and AI-assisted tools that complement human work.",
        "We may add, change, or retire features. If we remove a material paid feature, we will give reasonable notice or an appropriate plan adjustment.",
        "BrassHR does not provide legal, tax, payroll-processing, or employment advice. Payroll-ready exports are files you may upload to a payroll provider you choose. We are not your payroll company, background-check company, or employment lawyer.",
      ],
    },
    {
      title: "3. Accounts, Seats, and Tenant Isolation",
      paragraphs: [
        "You will designate one or more administrators. You are responsible for all activity under your tenant, including actions by recruiters, managers, and other users you invite.",
        "You must keep login credentials confidential and tell us promptly at hello@zipstaff.com if you suspect unauthorized access.",
        "Each tenant's HR data is scoped to that tenant. You may not attempt to access another tenant's data. We implement technical and organizational measures intended to keep tenants isolated, including tenant identifiers and access controls. No system is perfect; Section 11 describes our security approach and the limits of our responsibility.",
        "You may not exceed the worker, location, or feature limits of your plan except as we agree in writing or as the product allows through an upgrade.",
      ],
    },
    {
      title: "4. Fees, Trials, and Taxes",
      paragraphs: [
        "Fees are those shown on your order form, in-product plan, or invoice. Unless stated otherwise, subscriptions renew automatically at the then-current rate for the same term until canceled.",
        "Trials convert to a paid plan at the end of the trial unless you cancel before the trial ends. We may change list prices for renewal terms with notice before the renewal date.",
        "You authorize us and our payment processor to charge the payment method on file. Late amounts may accrue a finance charge of 1.5% per month or the maximum allowed by law, whichever is less. We may suspend the tenant for non-payment after notice.",
        "Fees are exclusive of taxes. You are responsible for sales, use, and similar taxes other than taxes on our net income.",
        "Except where required by law or stated on an order form, fees are non-refundable. Downgrades take effect at the next renewal unless we agree otherwise.",
      ],
    },
    {
      title: "5. Your Content and Customer Data",
      paragraphs: [
        "\"Customer Data\" means the information, files, and records you and your users submit to the Platform about your organization, applicants, workers, schedules, time, documents, and related HR activity.",
        "You retain all rights in Customer Data. You grant ZipStaff Inc. a limited license to host, process, transmit, display, and analyze Customer Data solely to provide, secure, and improve the Platform, to provide support, and to meet legal obligations.",
        "You represent that you have the right to submit Customer Data and that your collection and use of applicant and worker information complies with employment, privacy, immigration, wage-and-hour, and anti-discrimination laws that apply to you.",
        "You are the controller of Customer Data for your hiring and workforce purposes. ZipStaff Inc. processes that data as a service provider / processor on your instructions, except for the limited controller activities described in the Privacy Policy (accounts, billing, security, product improvement).",
        "A Data Processing Addendum will apply when executed. Until a DPA is signed, these Terms and the Privacy Policy describe how we handle Customer Data.",
      ],
    },
    {
      title: "6. Your Responsibilities",
      paragraphs: [
        "You agree to:",
        "• Use the Platform only for lawful HR, hiring, scheduling, and workforce operations for your own organization (or, if you are a staffing firm on a staffing plan, for placements you are authorized to manage).",
        "• Give applicants and workers any notices and obtain any consents your jurisdiction requires, including workplace monitoring, timeclock geolocation, and background-check disclosures.",
        "• Not use BrassHR as a substitute for required FCRA forms, I-9 compliance, or payroll tax filings.",
        "• Configure required documents, workflows, and PTO rules accurately. We do not police whether your policy is lawful.",
        "• Keep user access current. Remove people who should no longer see HR data.",
        "• Not upload data you do not need. Avoid full SSNs, bank account numbers, and medical diagnoses except in fields designed for a lawful purpose.",
        "• Not resell the Platform or use it to build a competing product.",
        "• Not probe, scrape, or interfere with the Platform or other tenants.",
        "You are solely responsible for employment decisions, pay, schedules, discipline, termination, and how you use AI- assisted rankings or suggestions.",
      ],
    },
    {
      title: "7. Artificial Intelligence",
      paragraphs: [
        "The Platform may include AI and automated tools that complement human work, such as candidate-to-job matching, resume parsing, missing-document flags, draft messages, and workflow suggestions.",
        "AI output can be incomplete or wrong. You agree that:",
        "• AI features assist your staff. They do not hire, reject, discipline, or set pay by themselves.",
        "• You will apply human review before taking an employment action that relies in material part on an AI output.",
        "• You are responsible for complying with equal-employment, disability, and automated-decision laws that apply to your hiring.",
        "• We may use third-party AI providers to process Customer Data solely to operate and improve these features, as described in the Privacy Policy.",
        "• We do not use Customer Data to train public, general-purpose AI models unrelated to operating the Platform unless we disclose that use and, where required, obtain additional agreement.",
        "You may disable some AI features where the product provides a control. Feature availability depends on plan and tenant configuration.",
      ],
    },
    {
      title: "8. Branding and Your Public Applicant Portal",
      paragraphs: [
        "You may upload a logo, colors, and related branding for your tenant. You grant us a license to display that branding on the portals and messages we send for your tenant.",
        "You are responsible for the content of job posts, emails, texts, and onboarding materials sent in your name.",
        "Applicants who use your portal agree to the Applicant Terms with ZipStaff Inc. as operator of the software; their application is still a submission to you.",
      ],
    },
    {
      title: "9. Integrations and Third Parties",
      paragraphs: [
        "You may enable e-signature, background screening, SMS, storage, payroll export, or other third-party tools. Those tools are provided by their vendors under their terms. We are not responsible for a vendor you enable or for data after you export it.",
        "If a vendor processes personal information for you, you are responsible for having an appropriate contract with that vendor unless we have listed that vendor as our subprocessor.",
      ],
    },
    {
      title: "10. Acceptable Use and Prohibited Data",
      paragraphs: [
        "You will not use the Platform to:",
        "• Violate law, including employment discrimination, wage theft, or unlawful surveillance.",
        "• Harass, exploit, or collect information about minors under 13.",
        "• Send spam or unsolicited marketing texts without required consent.",
        "• Upload malware or attempt to bypass tenant isolation, billing limits, or security.",
        "• Misrepresent your organization or post jobs that do not exist.",
        "We may suspend a tenant, user, or feature if we reasonably believe these Terms or law are being violated, or if continued operation would create a security or legal risk. We will give notice when practical.",
      ],
    },
    {
      title: "11. Security and Availability",
      paragraphs: [
        "We will use commercially reasonable efforts to maintain the Platform with safeguards appropriate to an HR SaaS product, including encryption in transit, encryption at rest for stored files, tenant-scoped access, private file paths, and audit logs of sensitive actions.",
        "We do not guarantee uninterrupted or error-free service. We may perform maintenance. We are not liable for delays caused by internet providers, mobile carriers, or third-party vendors.",
        "You are responsible for exporting records you must keep. We recommend you download payroll and compliance files on a regular schedule.",
      ],
    },
    {
      title: "12. Confidentiality",
      paragraphs: [
        "Each party may receive non-public information from the other. The receiving party will use that information only to perform under these Terms and will protect it with at least reasonable care. This duty does not apply to information that is public, independently developed, or rightfully received from a third party without a duty of confidence.",
        "We may identify you as a customer (name and logo) unless you tell us in writing not to. We will not publish your internal HR metrics without permission.",
      ],
    },
    {
      title: "13. Intellectual Property",
      paragraphs: [
        "ZipStaff Inc. and its licensors own the Platform, including software, AI features, designs, and the BrassHR and ZipStaff names. We grant you a limited, non-exclusive, non-transferable right to use the Platform during the subscription term for your internal business operations.",
        "You may not copy, reverse engineer, or create derivative works of the Platform except as allowed by law that cannot be waived.",
        "Feedback you give us may be used to improve the product without obligation to you.",
      ],
    },
    {
      title: "14. Term, Cancellation, and Data Return",
      paragraphs: [
        "These Terms start when you first accept them and continue for the subscription term, renewing as described in Section 4.",
        "You may cancel renewal in the product or by emailing hello@zipstaff.com before the renewal date. Cancellation stops future charges; it does not refund the current term unless an order form says otherwise.",
        "We may terminate for material breach if you do not cure within 15 days after notice, or immediately for non- payment, illegal use, or a security emergency.",
        "Upon termination or expiration, your paid access ends. For 30 days after termination (or longer if required by the customer agreement), you may request an export of Customer Data we still hold in a reasonable electronic format.",
        "After that period we will delete or de-identify Customer Data from active systems within a commercially reasonable time, except copies kept for legal, dispute, or backup purposes, which we will isolate and then delete on our backup cycle.",
        "You remain responsible for keeping copies of records the law requires you to retain (applications, I-9 supporting files, timesheets, and similar).",
      ],
    },
    {
      title: "15. Disclaimers",
      paragraphs: [
        "THE PLATFORM IS PROVIDED \"AS IS\" AND \"AS AVAILABLE.\" TO THE MAXIMUM EXTENT PERMITTED BY LAW, ZIPSTAFF INC. DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.",
        "WE DO NOT WARRANT THAT MATCH SCORES, PARSED RESUMES, TIME TOTALS, GEOLOCATION, OR EXPORTS ARE COMPLETE OR ERROR-FREE, OR THAT USE OF THE PLATFORM WILL SATISFY A PARTICULAR EMPLOYMENT OR PAYROLL LAW.",
      ],
    },
    {
      title: "16. Limitation of Liability",
      paragraphs: [
        "TO THE MAXIMUM EXTENT PERMITTED BY LAW, ZIPSTAFF INC. AND ITS AFFILIATES, OFFICERS, AND EMPLOYEES WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, LOST WAGES CLAIMS BY YOUR WORKERS, LOST DATA, OR BUSINESS INTERRUPTION, EVEN IF ADVISED OF THE POSSIBILITY.",
        "TO THE MAXIMUM EXTENT PERMITTED BY LAW, ZIPSTAFF INC.'S TOTAL LIABILITY ARISING OUT OF THESE TERMS OR THE PLATFORM WILL NOT EXCEED THE FEES YOU PAID TO ZIPSTAFF INC. FOR THE PLATFORM IN THE TWELVE (12) MONTHS BEFORE THE CLAIM.",
        "These limits do not apply to a party's fraud or willful misconduct, or to your payment obligations, to the extent such a limitation is unenforceable.",
      ],
    },
    {
      title: "17. Indemnification",
      paragraphs: [
        "You will defend and indemnify ZipStaff Inc. against claims, damages, and reasonable attorneys' fees arising from:",
        "(a) Customer Data; (b) your job posts, hiring or employment decisions, wage practices, or workplace policies; (c)",
        "your use of AI outputs; (d) your breach of these Terms; or (e) a claim that your branding or uploaded content infringes a third party's rights, except to the extent caused by our willful misconduct.",
        "We will defend and indemnify you against a third-party claim that the unmodified Platform, as provided by us, infringes a U.S. patent, copyright, or trademark, provided you give prompt notice and control of the defense. We may modify the Platform, obtain a license, or terminate the affected feature and refund prepaid fees for the unused portion of that feature. This is your exclusive remedy for infringement claims against the Platform.",
      ],
    },
    {
      title: "18. Insurance and Compliance",
      paragraphs: [
        "Each party will comply with laws applicable to its own business. You are responsible for industry rules that apply to your workforce (healthcare credentials, childcare, transportation, and similar). We are responsible for operating the software business.",
      ],
    },
    {
      title: "19. Changes to These Terms",
      paragraphs: [
        "We may update these Terms. The \"Last updated\" date will change when we do. If a change is material, we will give notice through the admin account or by email. Continued use after the effective date constitutes acceptance, except where law requires a fresh agreement. If you do not agree, cancel before the change takes effect.",
      ],
    },
    {
      title: "20. Assignment; Future BrassHR Entity",
      paragraphs: [
        "You may not assign these Terms without our consent, except to a successor that acquires substantially all of your business and assumes these Terms. We may assign these Terms, the Platform, and related records in connection with a reorganization, merger, sale of assets, or the formation of a dedicated BrassHR legal entity. After that assignment, \"we,\" \"us,\" and \"our\" mean the successor operator.",
      ],
    },
    {
      title: "21. Governing Law",
      paragraphs: [
        "These Terms are governed by the laws of the State of North Carolina, excluding conflict-of-law rules. The state and federal courts located in North Carolina will have exclusive jurisdiction, except that either party may seek injunctive relief in any court of competent jurisdiction to protect intellectual property, confidential information, or the Platform.",
        "If the parties later agree in writing to arbitration, that writing controls.",
      ],
    },
    {
      title: "22. General",
      paragraphs: [
        "These Terms, the Privacy Policy, any DPA, and any order form are the entire agreement for tenant use of the Platform and supersede prior discussions on that subject. If there is a conflict, an executed order form and DPA control over these Terms for the subject they cover. If a provision is unenforceable, the rest remains in effect.",
        "Failure to enforce a provision is not a waiver. Notices to us must be sent to hello@zipstaff.com. Notices to you may be sent to the admin email on the tenant account.",
      ],
    },
    {
      title: "23. Contact",
      paragraphs: [
        "ZipStaff Inc.",
        "Email: hello@zipstaff.com Support and billing questions: use the same address or the in-product support channel when available.",
      ],
    },
  ],
}
