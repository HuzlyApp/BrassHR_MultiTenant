"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { BookOpen, ChevronDown, Copy } from "lucide-react";

const SAMPLE_CREATE_JOB_MSP = `{
  "source_type": "MSP",
  "placement_type": "Recruit_and_Release",
  "employment_type": "W2",
  "title": "Registered Nurse - ICU",
  "source_job_title": "RN ICU",
  "profession": "Nursing",
  "external_req_id": "REQ-12345",
  "location": "Dallas, TX",
  "status": "open",
  "msp_name": "Example MSP",
  "msp_client_name": "Example Hospital",
  "facility_name": "Main Campus",
  "pay_rate": 55,
  "bill_rate": 75,
  "rate_unit": "hourly",
  "number_of_positions": 2,
  "job_duration": "13 weeks",
  "target_start_date": "2026-12-01",
  "expected_hours": 36,
  "description": "Provide ICU nursing care for adult patients.",
  "specialty": "ICU"
}`;

const SAMPLE_CREATE_JOB_MSP_MINIMAL = `{
  "employment_type": "W2",
  "title": "Registered Nurse - ICU",
  "profession": "Nursing",
  "external_req_id": "REQ-12345",
  "location": "Dallas, TX"
}`;

const SAMPLE_CREATE_JOB_INTERNAL = `{
  "source_type": "Internal",
  "employment_type": "W2",
  "title": "Staff Accountant",
  "status": "open",
  "location": "Remote",
  "description": "Full-time accounting role."
}`;

const SAMPLE_CREATE_JOB_RESPONSE = `{
  "id": "8f3c2a1b-....-....-....-............",
  "external_req_id": "REQ-12345",
  "title": "Registered Nurse - ICU",
  "status": "open",
  "created": true
}`;

const SAMPLE_SEARCH_JOB_RESPONSE = `{
  "found": true,
  "id": "8f3c2a1b-....-....-....-............",
  "external_req_id": "REQ-12345",
  "title": "Registered Nurse - ICU",
  "status": "open",
  "created_at": "2026-11-10T01:00:00.000Z"
}`;

const SAMPLE_CREATE_CANDIDATE_FIELDS = `{
  "file": "<resume.pdf | .docx | .txt — required>",
  "job_id": "<optional BrassHR job UUID>",
  "external_req_id": "REQ-12345",
  "source": "iLabor",
  "work_city": "Dallas",
  "work_state": "TX",
  "will_relocate": "true"
}`;

const SAMPLE_CREATE_CANDIDATE_CURL = `curl -X POST "https://YOUR_DOMAIN/api/v1/applicants/resume" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "file=@./resume.pdf" \\
  -F "external_req_id=REQ-12345" \\
  -F "source=iLabor" \\
  -F "work_city=Dallas" \\
  -F "work_state=TX" \\
  -F "will_relocate=true"`;

const SAMPLE_CREATE_CANDIDATE_RESPONSE = `{
  "applicant_id": "....",
  "email": "jane.doe@example.com",
  "phone": "+15551234567",
  "full_name": "Jane Doe",
  "resume_document_id": "....",
  "linked_job_id": "8f3c2a1b-....",
  "application_id": "....",
  "created": true
}`;

const SAMPLE_SEARCH_APPLICANT_RESPONSE = `{
  "found": true,
  "applicant_id": "....",
  "email": "jane.doe@example.com",
  "phone": "+15551234567",
  "full_name": "Jane Doe",
  "created_at": "2026-11-10T01:00:00.000Z"
}`;

const SAMPLE_CREATE_JOB_CURL = `curl -X POST "https://YOUR_DOMAIN/api/v1/jobs" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "employment_type": "W2",
    "title": "Registered Nurse - ICU",
    "profession": "Nursing",
    "external_req_id": "REQ-12345",
    "location": "Dallas, TX",
    "status": "open"
  }'`;

const SAMPLE_SEARCH_JOB_CURL = `curl "https://YOUR_DOMAIN/api/v1/jobs/search?external_req_id=REQ-12345" \\
  -H "Authorization: Bearer YOUR_API_KEY"`;

const SAMPLE_SEARCH_APPLICANT_CURL = `curl "https://YOUR_DOMAIN/api/v1/applicants/search?email=jane.doe%40example.com" \\
  -H "Authorization: Bearer YOUR_API_KEY"`;

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard");
  } catch {
    toast.error("Could not copy");
  }
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-[#F8FAFC]">
      <div className="flex items-center justify-between gap-2 border-b border-[#E5E7EB] bg-white px-3 py-2">
        <p className="text-[11px] font-medium text-[#374151]">{title}</p>
        <button
          type="button"
          onClick={() => void copyText(code)}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-2 text-[11px] text-[#111827]"
        >
          <Copy className="h-3 w-3" aria-hidden />
          Copy
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[11px] leading-5 text-[#111827]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function DocSection({
  id,
  title,
  children,
  defaultOpen = false,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[#E5E7EB] last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 py-3 text-left"
      >
        <span className="text-sm font-medium text-[#111827]">{title}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#6B7280] transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div id={id} className="space-y-3 pb-4 text-xs leading-5 text-[#4B5563]">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function FieldTable({
  rows,
}: {
  rows: Array<{ field: string; required: string; notes: string }>;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#E5E7EB]">
      <table className="min-w-full text-left text-[11px]">
        <thead className="bg-[#F9FAFB] text-[#6B7280]">
          <tr>
            <th className="px-3 py-2 font-medium">Field</th>
            <th className="px-3 py-2 font-medium">Required</th>
            <th className="px-3 py-2 font-medium">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E5E7EB] bg-white text-[#111827]">
          {rows.map((row) => (
            <tr key={row.field}>
              <td className="px-3 py-2 align-top">
                <code className="rounded bg-[#F3F4F6] px-1 py-0.5">{row.field}</code>
              </td>
              <td className="px-3 py-2 align-top whitespace-nowrap">{row.required}</td>
              <td className="px-3 py-2 align-top text-[#4B5563]">{row.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function IntegrationsApiDocs() {
  return (
    <section className="mt-6 rounded-xl border border-[#E5E7EB] bg-white p-5">
      <div className="mb-2 flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-[#F3F4F6] p-2 text-[#012352]">
          <BookOpen className="h-4 w-4" aria-hidden />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[#111827]">Inbound API documentation</h2>
          <p className="mt-1 text-xs leading-5 text-[#6B7280]">
            Use these endpoints to create and look up jobs and candidates. Replace{" "}
            <code className="rounded bg-[#F3F4F6] px-1 py-0.5 text-[11px]">YOUR_DOMAIN</code> with
            your BrassHR host and{" "}
            <code className="rounded bg-[#F3F4F6] px-1 py-0.5 text-[11px]">YOUR_API_KEY</code> with a
            key created above.
          </p>
        </div>
      </div>

      <DocSection id="docs-auth" title="1. Authentication" defaultOpen>
        <p>
          Every request must include your inbound API key in one of these headers:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <code className="rounded bg-[#F3F4F6] px-1 py-0.5">Authorization: Bearer YOUR_API_KEY</code>
          </li>
          <li>
            <code className="rounded bg-[#F3F4F6] px-1 py-0.5">X-API-Key: YOUR_API_KEY</code>
          </li>
        </ul>
        <p>
          Keys are tenant-scoped. Create a key above, copy it once, then store it in your MSP or
          ATS integration. Revoking a key immediately blocks further calls.
        </p>
      </DocSection>

      <DocSection id="docs-endpoints" title="2. Endpoints overview" defaultOpen>
        <FieldTable
          rows={[
            {
              field: "POST /api/v1/jobs",
              required: "JSON",
              notes: "Create a job requisition (idempotent on external_req_id).",
            },
            {
              field: "GET /api/v1/jobs/search",
              required: "Query",
              notes: "Find one job by id, external_req_id, or title. Listing all jobs is not supported.",
            },
            {
              field: "POST /api/v1/applicants/resume",
              required: "multipart",
              notes: "Upload a resume to create/update a candidate; optionally link to a job.",
            },
            {
              field: "GET /api/v1/applicants/search",
              required: "Query",
              notes: "Find one applicant by email or phone.",
            },
          ]}
        />
      </DocSection>

      <DocSection id="docs-create-job" title="3. Create a job — POST /api/v1/jobs" defaultOpen>
        <p>
          Content-Type: <code className="rounded bg-[#F3F4F6] px-1 py-0.5">application/json</code>.
          Default <code className="rounded bg-[#F3F4F6] px-1 py-0.5">source_type</code> is{" "}
          <code className="rounded bg-[#F3F4F6] px-1 py-0.5">MSP</code>. If the same{" "}
          <code className="rounded bg-[#F3F4F6] px-1 py-0.5">external_req_id</code> already exists,
          the API returns the existing job with <code className="rounded bg-[#F3F4F6] px-1 py-0.5">created: false</code>{" "}
          and HTTP 200. New jobs return HTTP 201.
        </p>

        <p className="font-medium text-[#111827]">Required fields</p>
        <FieldTable
          rows={[
            {
              field: "employment_type",
              required: "Always",
              notes: "W2 | 1099 | Contract",
            },
            {
              field: "title / public_title / source_job_title",
              required: "Always",
              notes: "At least one title field. MSP also accepts source_job_title alone.",
            },
            {
              field: "profession",
              required: "MSP",
              notes: "Required when source_type is MSP (default).",
            },
            {
              field: "external_req_id",
              required: "MSP",
              notes: "Or external_requisition_id. Used for idempotent create + search.",
            },
            {
              field: "location",
              required: "MSP",
              notes: "Work location string, e.g. Dallas, TX",
            },
            {
              field: "placement_type",
              required: "MSP",
              notes: "Internal | Recruit_and_Release | Recruit_and_EOR. Defaults to Recruit_and_Release for MSP.",
            },
            {
              field: "source_type",
              required: "Optional",
              notes: "MSP (default) | Internal",
            },
            {
              field: "status",
              required: "Optional",
              notes: "draft (default) | open | published (maps to open)",
            },
          ]}
        />

        <p className="font-medium text-[#111827]">Common optional fields</p>
        <p>
          <code className="rounded bg-[#F3F4F6] px-1 py-0.5">description</code>,{" "}
          <code className="rounded bg-[#F3F4F6] px-1 py-0.5">public_description</code>,{" "}
          <code className="rounded bg-[#F3F4F6] px-1 py-0.5">source_description</code>,{" "}
          <code className="rounded bg-[#F3F4F6] px-1 py-0.5">internal_requisition_number</code>,{" "}
          <code className="rounded bg-[#F3F4F6] px-1 py-0.5">job_source_code</code>,{" "}
          <code className="rounded bg-[#F3F4F6] px-1 py-0.5">specialty</code>,{" "}
          <code className="rounded bg-[#F3F4F6] px-1 py-0.5">msp_name</code>,{" "}
          <code className="rounded bg-[#F3F4F6] px-1 py-0.5">msp_client_name</code>,{" "}
          <code className="rounded bg-[#F3F4F6] px-1 py-0.5">facility_name</code>,{" "}
          <code className="rounded bg-[#F3F4F6] px-1 py-0.5">location_type</code>,{" "}
          <code className="rounded bg-[#F3F4F6] px-1 py-0.5">pay_rate</code>,{" "}
          <code className="rounded bg-[#F3F4F6] px-1 py-0.5">bill_rate</code>,{" "}
          <code className="rounded bg-[#F3F4F6] px-1 py-0.5">rate_unit</code>,{" "}
          <code className="rounded bg-[#F3F4F6] px-1 py-0.5">number_of_positions</code>,{" "}
          <code className="rounded bg-[#F3F4F6] px-1 py-0.5">source_job_url</code>,{" "}
          <code className="rounded bg-[#F3F4F6] px-1 py-0.5">years_of_experience</code>,{" "}
          <code className="rounded bg-[#F3F4F6] px-1 py-0.5">job_duration</code>,{" "}
          <code className="rounded bg-[#F3F4F6] px-1 py-0.5">target_start_date</code>,{" "}
          <code className="rounded bg-[#F3F4F6] px-1 py-0.5">expected_hours</code>,{" "}
          <code className="rounded bg-[#F3F4F6] px-1 py-0.5">benefits</code>,{" "}
          <code className="rounded bg-[#F3F4F6] px-1 py-0.5">internal_notes</code>
        </p>

        <CodeBlock title="Test payload — MSP minimal" code={SAMPLE_CREATE_JOB_MSP_MINIMAL} />
        <CodeBlock title="Test payload — MSP full" code={SAMPLE_CREATE_JOB_MSP} />
        <CodeBlock title="Test payload — Internal" code={SAMPLE_CREATE_JOB_INTERNAL} />
        <CodeBlock title="curl example" code={SAMPLE_CREATE_JOB_CURL} />
        <CodeBlock title="Example success response" code={SAMPLE_CREATE_JOB_RESPONSE} />
      </DocSection>

      <DocSection id="docs-search-job" title="4. Search a job — GET /api/v1/jobs/search">
        <p>
          Provide <strong className="font-medium text-[#111827]">exactly one</strong> query
          parameter:
        </p>
        <FieldTable
          rows={[
            {
              field: "id",
              required: "One of these",
              notes: "BrassHR job UUID",
            },
            {
              field: "external_req_id",
              required: "One of these",
              notes: "MSP / external requisition ID",
            },
            {
              field: "title",
              required: "One of these",
              notes: "Exact match on public_title or title",
            },
          ]}
        />
        <CodeBlock title="curl example" code={SAMPLE_SEARCH_JOB_CURL} />
        <CodeBlock title="Example found response (200)" code={SAMPLE_SEARCH_JOB_RESPONSE} />
        <CodeBlock
          title="Example not found response (404)"
          code={`{\n  "found": false\n}`}
        />
      </DocSection>

      <DocSection id="docs-create-candidate" title="5. Create a candidate — POST /api/v1/applicants/resume" defaultOpen>
        <p>
          Content-Type:{" "}
          <code className="rounded bg-[#F3F4F6] px-1 py-0.5">multipart/form-data</code> (not JSON).
          Name, email, and phone are parsed from the resume file. Max file size is about 10 MB.
        </p>
        <FieldTable
          rows={[
            {
              field: "file",
              required: "Yes",
              notes: "Resume file (.pdf, .docx, .txt, etc.)",
            },
            {
              field: "job_id",
              required: "No",
              notes: "Link application to BrassHR job UUID",
            },
            {
              field: "external_req_id",
              required: "No",
              notes: "Link application via external/MSP req ID",
            },
            {
              field: "source",
              required: "No",
              notes: "Source label, e.g. iLabor",
            },
            {
              field: "work_city",
              required: "No",
              notes: "Preferred when linking to a job",
            },
            {
              field: "work_state",
              required: "No",
              notes: "Preferred when linking to a job",
            },
            {
              field: "will_relocate",
              required: "No",
              notes: "true or 1",
            },
          ]}
        />
        <p>
          Parsing must yield a usable name and either email or phone. Creating a brand-new profile
          requires a parsed email. If you pass a job link, BrassHR creates or reuses an application
          for that candidate.
        </p>
        <CodeBlock title="Form fields (JSON representation)" code={SAMPLE_CREATE_CANDIDATE_FIELDS} />
        <CodeBlock title="curl test example" code={SAMPLE_CREATE_CANDIDATE_CURL} />
        <CodeBlock title="Example success response" code={SAMPLE_CREATE_CANDIDATE_RESPONSE} />
      </DocSection>

      <DocSection id="docs-search-applicant" title="6. Search an applicant — GET /api/v1/applicants/search">
        <p>
          Provide <strong className="font-medium text-[#111827]">exactly one</strong> of{" "}
          <code className="rounded bg-[#F3F4F6] px-1 py-0.5">email</code> or{" "}
          <code className="rounded bg-[#F3F4F6] px-1 py-0.5">phone</code>.
        </p>
        <CodeBlock title="curl example" code={SAMPLE_SEARCH_APPLICANT_CURL} />
        <CodeBlock title="Example found response" code={SAMPLE_SEARCH_APPLICANT_RESPONSE} />
      </DocSection>

      <DocSection id="docs-errors" title="7. Common errors">
        <FieldTable
          rows={[
            {
              field: "401",
              required: "Auth",
              notes: "Missing or invalid API key",
            },
            {
              field: "400 VALIDATION_ERROR",
              required: "Request",
              notes: "Missing required fields, wrong query shape, or invalid JSON/multipart",
            },
            {
              field: "404 NOT_FOUND",
              required: "Lookup",
              notes: "Job/applicant not found, or job_id / external_req_id does not resolve",
            },
            {
              field: "413 PAYLOAD_TOO_LARGE",
              required: "Resume",
              notes: "Resume exceeds the 10 MB limit",
            },
            {
              field: "422 UNPROCESSABLE",
              required: "Resume",
              notes: "Resume could not be parsed into a createable profile",
            },
          ]}
        />
      </DocSection>
    </section>
  );
}
