import type { CandidateRow } from "./types";

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function exportCandidatesCsv(rows: CandidateRow[], filename = "candidates.csv") {
  const headers = ["Name", "Reference", "Role", "Email", "Phone", "Address", "Status", "Applied"];
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.name,
        row.reference,
        row.role,
        row.email,
        row.phone,
        row.address,
        row.status,
        row.createdAt ?? "",
      ]
        .map((v) => escapeCsv(String(v ?? "")))
        .join(",")
    ),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
