#!/usr/bin/env python3
"""Migrate export/total_schema.json into the Zipstaff tenant on BrassHR production.

Source is the legacy Neon Zipstaff ATS dump. Target is public schema tables used by
the multi-tenant recruiter app (worker, applicant_profiles, job_requisitions,
job_applications, match analysis, notes, activity, resumes).
"""

from __future__ import annotations

import argparse
import base64
import datetime as dt
import json
import os
import re
import secrets
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any
from uuid import UUID, uuid5, NAMESPACE_URL

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_EXPORT = ROOT / "export" / "total_schema.json"
TENANT_ID = "efe85d96-536e-497b-9e1a-d8876d29feea"
WORKFLOW_ID = "e5a74e27-2f2d-4d59-a892-3aa6df80122a"
PROFILE_NS = uuid5(NAMESPACE_URL, "brasshr.zipstaff.applicant_profile")

STATUS_PIPELINE = {
    "New / Not Contacted": "new",
    "Attempted Contact": "new",
    "Unreachable": "new",
    "Initial Screening Complete": "reviewing",
    "Profile Uploaded": "reviewing",
    "Qualified-Ready for 2nd Interview": "shortlisted",
    "Approved -Upload to Portal": "shortlisted",
    "Submitted for MSP Review": "interviewing",
    "Approved by MSP": "interviewing",
    "Candidate selected": "hired",
    "Selected by MSP Client": "hired",
    "Rejected After 2nd Interview": "rejected",
    "Rejected at MSP Screening": "rejected",
    "Disqualified / Not a Fit": "rejected",
    "Candidate Rejected": "rejected",
    "Candidate Withdrew": "withdrawn",
    "Fit for future Roles": "archived",
    "Follow-up Needed": "undecided",
    "Callback - not available": "undecided",
}

SYSTEM_KEY_FOR_STATUS = {
    "New / Not Contacted": "new",
    "Candidate Rejected": "rejected",
    "Candidate selected": "hired",
    "Candidate Withdrew": "withdrawn",
    "Fit for future Roles": "archived",
}

CATEGORY_LABELS = {
    "STRONG_MATCH": "Strong Match",
    "GOOD_MATCH": "Good Match",
    "POSSIBLE_MATCH": "Possible Match",
    "WEAK_MATCH": "Weak Match",
    "NOT_A_MATCH": "Not a Match",
    "NOT_CURRENTLY_SUBMITTABLE": "Not Currently Submittable",
    "NEEDS_MORE_INFORMATION": "Needs More Information",
}

AI_MATCH_STATUSES = {"READY", "ANALYZING", "ANALYZED", "FAILED", "NEEDS_REVIEW"}
REQ_TYPES = {"MANDATORY", "PREFERRED"}
REQ_STATUSES = {"CONFIRMED", "PARTIAL", "NOT_FOUND", "CONFLICTING", "NOT_APPLICABLE"}
REQ_OUTCOMES = {"MET", "VERIFY", "NOT_MET", "CONFLICT", "NOT_APPLICABLE"}
EVIDENCE_SOURCES = {
    "RESUME",
    "VERIFIED_RECRUITER_INPUT",
    "JOB_DESCRIPTION",
    "STRUCTURED_JOB_FIELD",
    "RECRUITER_NOTE",
    "NONE",
}
ACTIVITY_SOURCES = {"recruiter", "tenant_admin", "super_admin", "system", "migration", "api"}


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$", line)
        if not m:
            continue
        key, val = m.group(1), m.group(2).strip()
        if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
            val = val[1:-1]
        os.environ.setdefault(key, val)


def is_uuid(value: Any) -> bool:
    if not isinstance(value, str) or len(value) != 36:
        return False
    try:
        UUID(value)
        return True
    except ValueError:
        return False


def clean(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def split_name(full: Any) -> tuple[str, str]:
    text = clean(full) or "Unknown Candidate"
    parts = text.split()
    if len(parts) == 1:
        return parts[0][:120], ""
    return parts[0][:120], " ".join(parts[1:])[:120]


def parse_location(loc: Any) -> tuple[str | None, str | None, str | None]:
    text = clean(loc)
    if not text:
        return None, None, None
    m = re.match(r"^(.+?),\s*([A-Za-z]{2})(?:\s+(\d{5}(?:-\d{4})?))?$", text)
    if m:
        return m.group(1).strip()[:120], m.group(2).upper(), m.group(3)
    return text[:200], None, None


def parse_date(value: Any) -> str | None:
    text = clean(value)
    if not text:
        return None
    text = text.replace(".", "/").replace("-", "/")
    parts = [p for p in text.split("/") if p]
    if len(parts) != 3:
        return None
    try:
        a, b, c = (int(p) for p in parts)
    except ValueError:
        return None
    if a > 31:
        year, month, day = a, b, c
    else:
        month, day, year = a, b, c
        if year < 100:
            year += 2000
    try:
        return dt.date(year, month, day).isoformat()
    except ValueError:
        return None


def req_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        items = [str(x).strip()[:1000] for x in value]
    else:
        items = [p.strip()[:1000] for p in re.split(r"[\n\r]+", str(value))]
    out: list[str] = []
    for item in items:
        if item and item not in out:
            out.append(item)
        if len(out) >= 40:
            break
    return out


def structured_requirements(raw: Any, location: str | None, specialty: str | None) -> dict[str, Any]:
    data = raw if isinstance(raw, dict) else {}
    return {
        "mandatoryRequirements": req_list(data.get("mandatory_requirements") or data.get("mandatoryRequirements")),
        "preferredRequirements": req_list(data.get("preferred_requirements") or data.get("preferredRequirements")),
        "requiredLicenses": req_list(data.get("required_licenses") or data.get("requiredLicenses")),
        "requiredCertifications": req_list(
            data.get("required_certifications") or data.get("requiredCertifications")
        ),
        "educationRequirements": req_list(
            data.get("education_requirements") or data.get("educationRequirements")
        ),
        "requiredYearsExperience": clean(
            data.get("required_years_experience") or data.get("requiredYearsExperience")
        ),
        "specialty": clean(data.get("specialty") or specialty),
        "location": clean(data.get("location") or location),
    }


def sanitize_filename(name: str) -> str:
    raw = unicodedata.normalize("NFKD", name or "resume.pdf").encode("ascii", "ignore").decode("ascii")
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", raw).strip("._") or "resume"
    if "." not in cleaned:
        cleaned += ".pdf"
    return cleaned[:180]


def resume_object_path(worker_id: str, file_id: str, file_name: str | None) -> str:
    ext = Path(sanitize_filename(file_name or "resume.pdf")).suffix.lower() or ".pdf"
    if ext not in {".pdf", ".doc", ".docx"}:
        ext = ".pdf"
    return f"admin-candidates/{TENANT_ID}/{worker_id}/{file_id}{ext}"


def as_jsonable(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, list):
        return [as_jsonable(v) for v in value]
    if isinstance(value, dict):
        return {str(k): as_jsonable(v) for k, v in value.items()}
    return str(value)


class RestClient:
    def __init__(self, base_url: str, service_key: str) -> None:
        self.base = base_url.rstrip("/")
        self.key = service_key

    def _headers(self, extra: dict[str, str] | None = None, json_body: bool = True) -> dict[str, str]:
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
        }
        if json_body:
            headers["Content-Type"] = "application/json"
        if extra:
            headers.update(extra)
        return headers

    def request(
        self,
        method: str,
        path: str,
        *,
        body: Any = None,
        headers: dict[str, str] | None = None,
        raw_body: bytes | None = None,
        timeout: int = 120,
    ) -> Any:
        url = path if path.startswith("http") else f"{self.base}{path}"
        data = raw_body
        json_body = raw_body is None
        if body is not None and raw_body is None:
            data = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            method=method,
            headers=self._headers(headers, json_body=json_body),
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                payload = resp.read()
                if not payload:
                    return None
                ctype = resp.headers.get("Content-Type", "")
                if "json" in ctype or payload[:1] in (b"{", b"["):
                    return json.loads(payload.decode("utf-8"))
                return payload
        except urllib.error.HTTPError as exc:
            err = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"{method} {url} -> {exc.code}: {err[:2000]}") from exc

    def rest(
        self,
        method: str,
        table: str,
        *,
        body: Any = None,
        params: str = "",
        prefer: str = "return=minimal",
    ) -> Any:
        path = f"/rest/v1/{table}{params}"
        headers = {"Prefer": prefer}
        return self.request(method, path, body=body, headers=headers)

    def upsert(self, table: str, rows: list[dict[str, Any]], on_conflict: str = "id") -> None:
        if not rows:
            return
        keys: list[str] = []
        seen: set[str] = set()
        for row in rows:
            for key in row:
                if key not in seen:
                    seen.add(key)
                    keys.append(key)
        normalized = [{key: row.get(key) for key in keys} for row in rows]
        self.rest(
            "POST",
            table,
            body=normalized,
            params=f"?on_conflict={urllib.parse.quote(on_conflict)}",
            prefer="resolution=merge-duplicates,return=minimal",
        )

    def insert(self, table: str, rows: list[dict[str, Any]]) -> None:
        if not rows:
            return
        keys: list[str] = []
        seen: set[str] = set()
        for row in rows:
            for key in row:
                if key not in seen:
                    seen.add(key)
                    keys.append(key)
        normalized = [{key: row.get(key) for key in keys} for row in rows]
        self.rest("POST", table, body=normalized, prefer="return=minimal")

    def get(self, table: str, params: str) -> list[dict[str, Any]]:
        data = self.rest("GET", table, params=params, prefer="return=representation")
        return data or []

    def patch(self, table: str, params: str, body: dict[str, Any]) -> None:
        self.rest("PATCH", table, body=body, params=params, prefer="return=minimal")

    def auth_admin(self, method: str, path: str, body: Any = None) -> Any:
        return self.request(method, f"/auth/v1/admin{path}", body=body)

    def storage_upload(self, bucket: str, object_path: str, content: bytes, content_type: str) -> None:
        encoded = urllib.parse.quote(object_path)
        self.request(
            "POST",
            f"/storage/v1/object/{bucket}/{encoded}",
            raw_body=content,
            headers={
                "Content-Type": content_type or "application/octet-stream",
                "x-upsert": "true",
            },
            timeout=180,
        )


def batched(items: list[Any], size: int):
    for i in range(0, len(items), size):
        yield items[i : i + size]


def load_staff_map(client: RestClient, profiles: list[dict[str, Any]]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    email_to_id: dict[str, str] = {}
    try:
        existing_users = client.request("GET", "/auth/v1/admin/users?per_page=200")
        users = existing_users.get("users", existing_users) if isinstance(existing_users, dict) else existing_users
        email_to_id = {
            str(u.get("email") or "").strip().lower(): u["id"]
            for u in (users or [])
            if u.get("id") and u.get("email")
        }
    except Exception as exc:
        print(f"  warning: could not list auth users ({exc})")

    for profile in profiles:
        old_id = profile["user_id"]
        email = (profile.get("email") or "").strip().lower()
        full_name = clean(profile.get("full_name")) or email
        first, last = split_name(full_name)
        role = "admin"
        if email in email_to_id:
            mapping[old_id] = email_to_id[email]
        else:
            password = secrets.token_urlsafe(24)
            payload: dict[str, Any] = {
                "id": old_id,
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {"full_name": full_name, "first_name": first, "last_name": last},
                "app_metadata": {
                    "provider": "email",
                    "providers": ["email"],
                    "role": "admin",
                    "tenant_id": TENANT_ID,
                    "migrated_from": "zipstaff-neon",
                },
            }
            try:
                created = client.auth_admin("POST", "/users", payload)
            except Exception as exc:
                payload.pop("id", None)
                try:
                    created = client.auth_admin("POST", "/users", payload)
                except Exception:
                    raise RuntimeError(f"Failed creating auth user for {email}: {exc}") from exc
            new_id = created.get("id") if isinstance(created, dict) else None
            if not new_id:
                raise RuntimeError(f"Failed creating auth user for {email}: {created}")
            mapping[old_id] = new_id
            email_to_id[email] = new_id

        user_id = mapping[old_id]
        client.upsert(
            "users",
            [
                {
                    "id": user_id,
                    "tenant_id": TENANT_ID,
                    "email": email,
                    "first_name": first,
                    "last_name": last or None,
                    "role": role,
                    "is_active": True,
                    "email_verified": True,
                    "onboarding_completed": True,
                    "god_admin": False,
                }
            ],
        )
        client.upsert(
            "user_roles",
            [{"user_id": user_id, "tenant_id": TENANT_ID, "role": "admin"}],
            on_conflict="user_id,tenant_id",
        )
        print(f"  staff {email} -> {user_id}")
    return mapping


def staff_or_none(mapping: dict[str, str], old_id: Any) -> str | None:
    if not old_id:
        return None
    return mapping.get(str(old_id))


def uniquify_emails(candidates: list[dict[str, Any]]) -> dict[str, str | None]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for cand in candidates:
        email = (cand.get("email") or cand.get("email_normalized") or "").strip().lower()
        if email:
            grouped[email].append(cand)
    keep: dict[str, str | None] = {}
    for cand in candidates:
        keep[cand["id"]] = None
    for email, rows in grouped.items():
        rows.sort(key=lambda r: r.get("created_at") or "")
        keep[rows[0]["id"]] = email
    return keep


def job_status(workspace: dict[str, Any]) -> tuple[str, bool]:
    if (workspace.get("workspace_status") or "").upper() == "ARCHIVED":
        return "archived", False
    if (workspace.get("job_status") or "").upper() == "CLOSED":
        return "closed", False
    return "published", True


def migrate(export_path: Path, skip_files: bool) -> None:
    load_dotenv(ROOT / ".env")
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

    print(f"Loading {export_path} ...")
    data = json.loads(export_path.read_text(encoding="utf-8"))
    client = RestClient(url, key)

    print("Updating Zipstaff tenant slug/name/subdomain ...")
    client.patch(
        "tenants",
        f"?id=eq.{TENANT_ID}",
        {
            "name": "Zipstaff",
            "slug": "zipstaff",
            "subdomain": "zipstaff",
            "is_active": True,
        },
    )

    print("Creating/mapping staff users ...")
    staff = load_staff_map(client, data["user_profiles"])

    print("Inserting application statuses ...")
    status_rows = []
    for row in data["candidate_statuses"]:
        name = (row.get("name") or "").strip()
        status_rows.append(
            {
                "id": row["id"],
                "tenant_id": TENANT_ID,
                "name": name,
                "color": clean(row.get("color")),
                "sort_order": int(row.get("display_order") or 0),
                "is_active": bool(row.get("is_active", True)),
                "is_default": bool(row.get("is_default")),
                "system_key": SYSTEM_KEY_FOR_STATUS.get(name),
                "created_by": staff_or_none(staff, row.get("created_by_user_id")),
                "created_at": row.get("created_at"),
                "updated_at": row.get("updated_at") or row.get("created_at"),
            }
        )
    client.upsert("application_statuses", status_rows)
    status_name = {r["id"]: r["name"] for r in status_rows}

    print("Inserting job requisitions ...")
    used_numbers: set[str] = set()
    job_rows = []
    for ws in data["job_match_workspaces"]:
        title = clean(ws.get("job_title")) or "Untitled role"
        description = clean(ws.get("job_description_text")) or title
        msp = clean(ws.get("msp_or_client"))
        source_type = "MSP" if msp else "Internal"
        placement_type = "Recruit_and_Release" if source_type == "MSP" else "Internal"
        employment_type = "Contract" if source_type == "MSP" else "W2"
        status, published = job_status(ws)
        city, state, postal = parse_location(ws.get("location"))
        job_ref = clean(ws.get("job_ref"))
        number = f"JOB-ZS-{job_ref}" if job_ref else f"JOB-ZS-{ws['id'][:8].upper()}"
        base = number
        n = 2
        while number in used_numbers:
            number = f"{base}-{n}"
            n += 1
        used_numbers.add(number)
        created_by = staff_or_none(staff, ws.get("owner_user_id"))
        job_rows.append(
            {
                "id": ws["id"],
                "tenant_id": TENANT_ID,
                "title": title[:500],
                "public_title": title[:500],
                "description": description,
                "public_description": description,
                "external_req_id": job_ref,
                "internal_requisition_number": job_ref,
                "msp_name": msp,
                "msp_client": msp,
                "msp_client_name": msp,
                "source_type": source_type,
                "placement_type": placement_type,
                "employment_type": employment_type,
                "eor_type": "MSP" if source_type == "MSP" else "Tenant",
                "location": clean(ws.get("location")),
                "city": city,
                "state_province": state,
                "postal_code": postal,
                "country": "US",
                "department": clean(ws.get("department")),
                "specialty": clean(ws.get("specialty")),
                "shift_details": clean(ws.get("shift")),
                "schedule": clean(ws.get("shift")),
                "target_start_date": parse_date(ws.get("start_date")),
                "status": status,
                "is_published": published,
                "published_at": ws.get("created_at") if published else None,
                "created_by": created_by,
                "assigned_recruiter": created_by,
                "created_at": ws.get("created_at"),
                "updated_at": ws.get("updated_at") or ws.get("created_at"),
                "job_number": number,
                "workflow_id": WORKFLOW_ID,
                "workflow_assignment_mode": "manual",
                "idempotency_key": f"zipstaff-legacy-{ws['id']}",
                "structured_requirements": structured_requirements(
                    ws.get("structured_requirements"), clean(ws.get("location")), clean(ws.get("specialty"))
                ),
                "ai_match_enabled": True,
                "source_job_title": title,
            }
        )
    client.upsert("job_requisitions", job_rows)
    job_ids = {r["id"] for r in job_rows}

    print("Inserting workers + applicant profiles ...")
    email_keep = uniquify_emails(data["candidates"])
    workers = []
    profiles = []
    profile_of: dict[str, str] = {}
    worker_ids: set[str] = set()
    for cand in data["candidates"]:
        cid = cand["id"]
        worker_ids.add(cid)
        first, last = split_name(cand.get("full_name") or cand.get("normalized_full_name"))
        city, state, postal = parse_location(cand.get("location"))
        email = email_keep.get(cid)
        recruiter = staff_or_none(staff, cand.get("assigned_recruiter_id") or cand.get("owner_user_id"))
        workers.append(
            {
                "id": cid,
                "tenant_id": TENANT_ID,
                "first_name": first,
                "last_name": last or None,
                "email": email,
                "phone": clean(cand.get("phone") or cand.get("phone_normalized")),
                "city": city,
                "state": state,
                "zip": postal,
                "job_role": clean(cand.get("specialty")),
                "about_me": None,
                "status": "new",
                "worker_status": "new",
                "onboarding_status": "pending",
                "assigned_recruiter_user_id": recruiter,
                "created_at": cand.get("created_at"),
                "updated_at": cand.get("updated_at") or cand.get("created_at"),
            }
        )
        pid = cid
        profile_of[cid] = pid
        profiles.append(
            {
                "id": pid,
                "tenant_id": TENANT_ID,
                "worker_id": cid,
                "email": email,
                "normalized_email": email,
                "first_name": first,
                "last_name": last or None,
                "phone": clean(cand.get("phone") or cand.get("phone_normalized")),
                "city_state_zip": clean(cand.get("location")),
                "created_at": cand.get("created_at"),
                "updated_at": cand.get("updated_at") or cand.get("created_at"),
            }
        )
    for chunk in batched(workers, 100):
        client.upsert("worker", chunk)
    for chunk in batched(profiles, 100):
        client.upsert("applicant_profiles", chunk)

    print("Inserting job applications + AI analysis ...")
    analyses_by_id = {a["id"]: a for a in data["candidate_match_analyses"]}
    cand_by_id = {c["id"]: c for c in data["candidates"]}
    app_by_analysis: dict[str, str] = {}
    applications = []
    for link in data["job_match_candidates"]:
        if link["workspace_id"] not in job_ids or link["candidate_id"] not in worker_ids:
            continue
        cand = cand_by_id.get(link["candidate_id"])
        analysis = analyses_by_id.get(link.get("latest_analysis_id"))
        status_id = cand.get("current_status_id") if cand else None
        status_label = status_name.get(status_id or "", "")
        pipeline = STATUS_PIPELINE.get(status_label, "custom")
        ai_status = (link.get("status") or "READY").upper()
        if ai_status not in AI_MATCH_STATUSES:
            ai_status = "READY"
        assigned = staff_or_none(
            staff,
            (cand or {}).get("assigned_recruiter_id") or link.get("owner_user_id"),
        )
        row = {
            "id": link["id"],
            "tenant_id": TENANT_ID,
            "job_requisition_id": link["workspace_id"],
            "applicant_profile_id": profile_of[link["candidate_id"]],
            "worker_id": link["candidate_id"],
            "workflow_id": WORKFLOW_ID,
            "status": pipeline,
            "status_id": status_id if status_id in status_name else None,
            "source": "admin",
            "workflow_phase": "pre_hire",
            "created_by_staff_user_id": assigned,
            "assigned_recruiter_user_id": assigned,
            "submitted_at": link.get("created_at"),
            "created_at": link.get("created_at"),
            "updated_at": link.get("updated_at") or link.get("created_at"),
            "ai_match_status": ai_status,
            "ai_match_score": None,
            "ai_match_category": None,
            "ai_match_action": None,
            "ai_match_readiness": None,
            "ai_match_display_category": None,
            "ai_analysis_raw": None,
            "ai_analysis": None,
            "ai_analyzed_at": None,
            "ai_analysis_error": None,
            "ai_analysis_version": 0,
            "ai_analysis_model": None,
            "ai_analyzed_by": None,
        }
        if analysis:
            app_by_analysis[analysis["id"]] = link["id"]
            row.update(
                {
                    "ai_match_score": analysis.get("overall_match_score"),
                    "ai_match_category": clean(analysis.get("match_category")),
                    "ai_match_action": clean(analysis.get("recommended_action")),
                    "ai_match_readiness": clean(analysis.get("submission_readiness")),
                    "ai_match_display_category": CATEGORY_LABELS.get(
                        str(analysis.get("match_category") or ""),
                        clean(analysis.get("match_category")),
                    ),
                    "ai_analysis_raw": as_jsonable(analysis.get("ai_raw_response_json")),
                    "ai_analysis": as_jsonable(analysis.get("validated_result_json")),
                    "ai_analyzed_at": analysis.get("analyzed_at") or analysis.get("updated_at"),
                    "ai_analysis_error": clean(analysis.get("analysis_error")),
                    "ai_analysis_version": 1,
                    "ai_analysis_model": clean(analysis.get("ai_model") or analysis.get("model_name")),
                    "ai_analyzed_by": staff_or_none(staff, analysis.get("recruiter_id")),
                }
            )
        applications.append(row)
    for chunk in batched(applications, 25):
        client.upsert("job_applications", chunk)
    app_ids = {r["id"] for r in applications}
    worker_to_app: dict[str, str] = {}
    for row in applications:
        worker_to_app.setdefault(row["worker_id"], row["id"])

    print("Inserting analysis versions ...")
    version_rows = []
    seen_versions: set[tuple[str, int]] = set()
    for analysis in data["candidate_match_analyses"]:
        app_id = app_by_analysis.get(analysis["id"]) or next(
            (
                l["id"]
                for l in data["job_match_candidates"]
                if l.get("latest_analysis_id") == analysis["id"] and l["id"] in app_ids
            ),
            None,
        )
        if not app_id:
            continue
        version = 1
        key = (app_id, version)
        if key in seen_versions:
            continue
        seen_versions.add(key)
        version_rows.append(
            {
                "id": analysis["id"],
                "tenant_id": TENANT_ID,
                "application_id": app_id,
                "version": version,
                "analysis": as_jsonable(analysis.get("validated_result_json") or {}),
                "score": analysis.get("overall_match_score"),
                "category": clean(analysis.get("match_category")),
                "recommended_action": clean(analysis.get("recommended_action")),
                "display_category": CATEGORY_LABELS.get(
                    str(analysis.get("match_category") or ""), clean(analysis.get("match_category"))
                ),
                "model": clean(analysis.get("ai_model") or analysis.get("model_name")),
                "analyzed_by": staff_or_none(staff, analysis.get("recruiter_id")),
                "analyzed_at": analysis.get("analyzed_at") or analysis.get("created_at"),
                "created_at": analysis.get("created_at"),
            }
        )
    for hist in data["candidate_match_analysis_versions"]:
        app_id = app_by_analysis.get(hist.get("analysis_id"))
        if not app_id:
            continue
        version = int(hist.get("version_number") or 2)
        if version <= 1:
            version = 2
        key = (app_id, version)
        while key in seen_versions:
            version += 1
            key = (app_id, version)
        seen_versions.add(key)
        version_rows.append(
            {
                "id": hist["id"],
                "tenant_id": TENANT_ID,
                "application_id": app_id,
                "version": version,
                "analysis": as_jsonable(hist.get("validated_result_json") or {}),
                "score": hist.get("overall_match_score"),
                "category": clean(hist.get("match_category")),
                "recommended_action": clean(hist.get("recommended_action")),
                "model": clean(hist.get("model_name")),
                "analyzed_by": staff_or_none(staff, hist.get("created_by")),
                "analyzed_at": hist.get("created_at"),
                "created_at": hist.get("created_at"),
            }
        )
    for chunk in batched(version_rows, 25):
        client.upsert("job_application_analysis_versions", chunk)

    print("Inserting match requirements (latest analysis only) ...")
    latest_ids = {l.get("latest_analysis_id") for l in data["job_match_candidates"] if l.get("latest_analysis_id")}
    req_rows = []
    seen_req: set[tuple[str, str, str]] = set()
    sort_by_app: dict[str, int] = defaultdict(int)
    for req in data["candidate_match_requirements"]:
        analysis_id = req.get("analysis_id")
        if analysis_id not in latest_ids:
            continue
        app_id = app_by_analysis.get(analysis_id)
        if not app_id:
            continue
        rtype = (req.get("requirement_type") or "MANDATORY").upper()
        if rtype not in REQ_TYPES:
            rtype = "PREFERRED" if "pref" in rtype.lower() else "MANDATORY"
        status = (req.get("evidence_status") or "NOT_FOUND").upper()
        if status not in REQ_STATUSES:
            status = "NOT_FOUND"
        outcome = (req.get("requirement_outcome") or "VERIFY").upper()
        if outcome not in REQ_OUTCOMES:
            outcome = "VERIFY"
        source = (req.get("evidence_source") or "NONE").upper()
        if source not in EVIDENCE_SOURCES:
            source = "NONE"
        text = (req.get("requirement_text") or "").strip() or "Requirement"
        dedupe = (app_id, rtype, text.lower())
        if dedupe in seen_req:
            continue
        seen_req.add(dedupe)
        sort_by_app[app_id] += 1
        req_rows.append(
            {
                "id": req["id"],
                "tenant_id": TENANT_ID,
                "job_application_id": app_id,
                "requirement_text": text,
                "requirement_type": rtype,
                "status": status,
                "requirement_outcome": outcome,
                "candidate_evidence": req.get("candidate_evidence") or "",
                "evidence_source": source,
                "impact": req.get("impact") or "",
                "verification_required": bool(req.get("verification_required")),
                "confidence": req.get("confidence") if req.get("confidence") is not None else 0,
                "sort_order": sort_by_app[app_id],
                "recruiter_verified": bool(req.get("recruiter_verified")),
                "recruiter_note": clean(req.get("recruiter_verification_note")),
                "created_at": req.get("created_at"),
                "updated_at": req.get("updated_at") or req.get("created_at"),
            }
        )
    for chunk in batched(req_rows, 150):
        client.upsert("job_application_match_requirements", chunk)

    print("Inserting screening answers + verified information ...")
    screen_rows = []
    used_qkeys: set[tuple[str, str]] = set()
    for ans in data["candidate_screening_answers"]:
        app_id = app_by_analysis.get(ans.get("analysis_id")) or next(
            (
                l["id"]
                for l in data["job_match_candidates"]
                if l["candidate_id"] == ans.get("candidate_id")
                and l["workspace_id"] == ans.get("workspace_id")
                and l["id"] in app_ids
            ),
            None,
        )
        if not app_id:
            continue
        qkey = f"legacy-{ans['id'][:12]}"
        if (app_id, qkey) in used_qkeys:
            continue
        used_qkeys.add((app_id, qkey))
        screen_rows.append(
            {
                "id": ans["id"],
                "tenant_id": TENANT_ID,
                "application_id": app_id,
                "question_key": qkey,
                "question_text": ans.get("question") or "Screening question",
                "answer_text": clean(ans.get("answer")),
                "related_requirement": clean(ans.get("related_requirement")),
                "created_at": ans.get("created_at"),
                "updated_at": ans.get("updated_at") or ans.get("created_at"),
            }
        )
    client.upsert("job_application_ai_screening_answers", screen_rows)

    verified_rows = []
    for cand in data["candidates"]:
        info = cand.get("verified_information")
        if not info or info in ({}, [], None):
            continue
        app_id = worker_to_app.get(cand["id"])
        if not app_id:
            continue
        if isinstance(info, dict):
            for key, val in info.items():
                text = clean(val)
                if not text:
                    continue
                category = "availability" if "avail" in key.lower() else "note"
                verified_rows.append(
                    {
                        "id": str(uuid5(PROFILE_NS, f"{cand['id']}:{key}")),
                        "tenant_id": TENANT_ID,
                        "application_id": app_id,
                        "category": category,
                        "title": key.replace("_", " ").strip()[:200] or "Verified note",
                        "details": text,
                        "verified_by": staff_or_none(staff, cand.get("assigned_recruiter_id")),
                        "verified_at": cand.get("updated_at") or cand.get("created_at"),
                        "created_at": cand.get("updated_at") or cand.get("created_at"),
                    }
                )
    if verified_rows:
        client.upsert("job_application_verified_information", verified_rows)

    print("Inserting worker notes ...")
    note_rows = []
    for note in data["candidate_notes"]:
        if note.get("deleted_at"):
            continue
        body = clean(note.get("note_text"))
        if not body:
            continue
        if note.get("candidate_id") not in worker_ids:
            continue
        note_rows.append(
            {
                "id": note["id"],
                "tenant_id": TENANT_ID,
                "worker_id": note["candidate_id"],
                "application_id": worker_to_app.get(note["candidate_id"]),
                "created_by_user_id": staff_or_none(staff, note.get("author_user_id")),
                "body": body,
                "created_at": note.get("created_at"),
                "updated_at": note.get("updated_at") or note.get("created_at"),
            }
        )
    client.upsert("worker_notes", note_rows)

    print("Inserting recruiter activity logs ...")
    note_ids = {n["id"] for n in note_rows}
    activity_rows = []
    for log in data["candidate_activity_logs"]:
        source = (log.get("source") or "migration").lower()
        if source not in ACTIVITY_SOURCES:
            source = "migration"
        label = clean(log.get("action_label")) or clean(log.get("action_type")) or "Activity"
        candidate_id = log.get("candidate_id") if log.get("candidate_id") in worker_ids else None
        job_id = log.get("job_id") if log.get("job_id") in job_ids else None
        activity_rows.append(
            {
                "id": log["id"],
                "tenant_id": TENANT_ID,
                "recruiter_user_id": staff_or_none(staff, log.get("performed_by_user_id")),
                "candidate_id": candidate_id,
                "job_id": job_id,
                "analysis_id": log.get("analysis_id") if is_uuid(log.get("analysis_id")) else None,
                "note_id": log.get("note_id") if log.get("note_id") in note_ids else None,
                "activity_type": clean(log.get("action_type")) or "UNKNOWN",
                "action_label": label[:500],
                "previous_value": None if log.get("previous_value") is None else str(log.get("previous_value"))[:2000],
                "new_value": None if log.get("new_value") is None else str(log.get("new_value"))[:2000],
                "metadata": as_jsonable(log.get("metadata") or {}),
                "source": source,
                "request_id": clean(log.get("request_id")),
                "created_at": log.get("created_at"),
            }
        )
    for chunk in batched(activity_rows, 200):
        client.upsert("recruiter_activity_logs", chunk)

    print("Inserting application status history ...")
    history_rows = []
    for log in data["candidate_activity_logs"]:
        if log.get("action_type") != "STATUS_CHANGED":
            continue
        meta = log.get("metadata") if isinstance(log.get("metadata"), dict) else {}
        app_id = worker_to_app.get(log.get("candidate_id"))
        if not app_id:
            continue
        to_name = str(log.get("new_value") or "").strip() or "Unknown"
        from_name = clean(log.get("previous_value"))
        to_id = meta.get("new_status_id") if meta.get("new_status_id") in status_name else None
        from_id = meta.get("previous_status_id") if meta.get("previous_status_id") in status_name else None
        history_rows.append(
            {
                "id": log["id"],
                "tenant_id": TENANT_ID,
                "application_id": app_id,
                "from_status_id": from_id,
                "from_status_name": from_name,
                "to_status_id": to_id,
                "to_status_name": to_name[:200],
                "changed_by_user_id": staff_or_none(staff, log.get("performed_by_user_id")),
                "note": clean(meta.get("note")),
                "created_at": log.get("created_at"),
            }
        )
    for chunk in batched(history_rows, 150):
        client.upsert("application_status_history", chunk)

    print("Inserting generic activity_logs from audit_logs ...")
    audit_rows = []
    for log in data["audit_logs"]:
        entity_id = log.get("entity_id") if is_uuid(log.get("entity_id")) else None
        audit_rows.append(
            {
                "id": log["id"],
                "tenant_id": TENANT_ID,
                "user_id": staff_or_none(staff, log.get("actor_user_id")),
                "action": clean(log.get("action")) or "UNKNOWN",
                "entity_type": clean(log.get("entity_type")) or "unknown",
                "entity_id": entity_id,
                "details": {
                    "previous": as_jsonable(log.get("previous_value_json")),
                    "new": as_jsonable(log.get("new_value_json")),
                    "migrated_from": "zipstaff-neon",
                },
                "created_at": log.get("created_at"),
            }
        )
    for chunk in batched(audit_rows, 200):
        client.upsert("activity_logs", chunk)

    print("Inserting worker resumes ...")
    resume_rows = []
    upload_jobs: list[tuple[dict[str, Any], bytes, str]] = []
    extracted_by_worker = {c["id"]: c.get("extracted_resume_text") for c in data["candidates"]}
    for ef in data["entity_files"]:
        worker_id = ef.get("entity_id")
        if worker_id not in worker_ids:
            continue
        file_name = sanitize_filename(ef.get("file_name") or "resume.pdf")
        storage_path = resume_object_path(worker_id, ef["id"], ef.get("file_name"))
        mime = clean(ef.get("mime_type")) or "application/octet-stream"
        extracted = ef.get("extracted_text") or extracted_by_worker.get(worker_id)
        resume_rows.append(
            {
                "id": ef["id"],
                "worker_id": worker_id,
                "tenant_id": TENANT_ID,
                "file_url": storage_path,
                "storage_path": storage_path,
                "original_file_name": file_name,
                "file_name": file_name,
                "file_type": clean(ef.get("file_type") or ef.get("mime_type")),
                "file_size_bytes": ef.get("byte_size"),
                "extracted_text": extracted,
                "text_length": len(extracted) if extracted else None,
                "parsed_data": {},
                "parsing_status": "completed" if extracted else "pending",
                "parse_status": "completed" if extracted else "pending",
                "uploaded_at": ef.get("created_at"),
                "parsed_at": ef.get("updated_at") or ef.get("created_at"),
                "job_application_id": worker_to_app.get(worker_id),
                "uploaded_by_user_id": staff_or_none(staff, ef.get("owner_user_id") or ef.get("created_by")),
            }
        )
        if not skip_files and ef.get("file_bytes_base64"):
            try:
                raw = base64.b64decode(ef["file_bytes_base64"])
            except Exception:
                continue
            upload_jobs.append((ef, raw, mime))

    for chunk in batched(resume_rows, 40):
        client.upsert("worker_resumes", chunk)

    if skip_files:
        print(f"Skipped {len(upload_jobs)} resume file uploads")
    else:
        print(f"Uploading {len(upload_jobs)} resume files to worker-resumes ...")
        ok = 0
        fail = 0

        def _upload(job: tuple[dict[str, Any], bytes, str]) -> None:
            ef, raw, mime = job
            file_name = sanitize_filename(ef.get("file_name") or "resume.pdf")
            path = resume_object_path(ef["entity_id"], ef["id"], ef.get("file_name"))
            client.storage_upload("worker-resumes", path, raw, mime)

        with ThreadPoolExecutor(max_workers=4) as pool:
            futures = [pool.submit(_upload, job) for job in upload_jobs]
            for i, fut in enumerate(as_completed(futures), 1):
                try:
                    fut.result()
                    ok += 1
                except Exception as exc:
                    fail += 1
                    if fail <= 8:
                        print("  upload failed:", str(exc).encode("ascii", "replace").decode("ascii")[:400])
                if i % 50 == 0:
                    print(f"  uploaded {i}/{len(upload_jobs)} (ok={ok} fail={fail})")
        print(f"Resume uploads complete ok={ok} fail={fail}")

    print("Migration finished.")
    print(
        json.dumps(
            {
                "tenant_id": TENANT_ID,
                "staff": len(staff),
                "statuses": len(status_rows),
                "jobs": len(job_rows),
                "workers": len(workers),
                "applications": len(applications),
                "requirements": len(req_rows),
                "notes": len(note_rows),
                "activity": len(activity_rows),
                "history": len(history_rows),
                "audit": len(audit_rows),
                "resumes": len(resume_rows),
            },
            indent=2,
        )
    )


def migrate_files_only(export_path: Path) -> None:
    load_dotenv(ROOT / ".env")
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

    print(f"Loading {export_path} for resume uploads ...")
    data = json.loads(export_path.read_text(encoding="utf-8"))
    client = RestClient(url, key)
    worker_ids = {c["id"] for c in data["candidates"]}
    jobs: list[tuple[dict[str, Any], bytes, str]] = []
    for ef in data["entity_files"]:
        if ef.get("entity_id") not in worker_ids or not ef.get("file_bytes_base64"):
            continue
        try:
            raw = base64.b64decode(ef["file_bytes_base64"])
        except Exception:
            continue
        mime = clean(ef.get("mime_type")) or "application/octet-stream"
        jobs.append((ef, raw, mime))
    print(f"Uploading {len(jobs)} resume files to worker-resumes ...")
    ok = 0
    fail = 0

    def _upload(job: tuple[dict[str, Any], bytes, str]) -> str:
        ef, raw, mime = job
        path = resume_object_path(ef["entity_id"], ef["id"], ef.get("file_name"))
        client.storage_upload("worker-resumes", path, raw, mime)
        return path

    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(_upload, job): job[0] for job in jobs}
        for i, fut in enumerate(as_completed(futures), 1):
            ef = futures[fut]
            try:
                path = fut.result()
                client.patch(
                    "worker_resumes",
                    f"?id=eq.{ef['id']}",
                    {"file_url": path, "storage_path": path, "file_name": sanitize_filename(ef.get("file_name") or "resume.pdf")},
                )
                ok += 1
            except Exception as exc:
                fail += 1
                if fail <= 8:
                    print("  upload failed:", str(exc).encode("ascii", "replace").decode("ascii")[:400])
            if i % 50 == 0:
                print(f"  uploaded {i}/{len(jobs)} (ok={ok} fail={fail})", flush=True)
    print(f"Resume uploads complete ok={ok} fail={fail}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--export", default=str(DEFAULT_EXPORT))
    parser.add_argument("--skip-files", action="store_true")
    parser.add_argument("--files-only", action="store_true")
    args = parser.parse_args()
    started = time.time()
    if args.files_only:
        migrate_files_only(Path(args.export))
    else:
        migrate(Path(args.export), skip_files=args.skip_files)
    print(f"Elapsed {time.time() - started:.1f}s")


if __name__ == "__main__":
    main()
