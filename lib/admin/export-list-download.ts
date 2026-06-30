export type ExportColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

function cellText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

export function formatExportDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function spreadsheetCellType(value: string): "String" | "Number" {
  return /^\d+(\.\d+)?$/.test(value) ? "Number" : "String";
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportRowsAsCsv<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename = "export.csv"
) {
  const lines = [
    columns.map((col) => escapeCsv(col.header)).join(","),
    ...rows.map((row) =>
      columns
        .map((col) => escapeCsv(cellText(col.value(row))))
        .join(",")
    ),
  ];

  const blob = new Blob(["\uFEFF", lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, filename);
}

/** Excel SpreadsheetML (.xls) — opens with headers + data in Excel and LibreOffice. */
export function exportRowsAsXls<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename = "export.xls"
) {
  const headerCells = columns
    .map(
      (col) =>
        `<Cell><Data ss:Type="String">${escapeXml(col.header)}</Data></Cell>`
    )
    .join("");

  const bodyRows = rows
    .map((row) => {
      const cells = columns
        .map((col) => {
          const text = cellText(col.value(row));
          const type = spreadsheetCellType(text);
          return `<Cell><Data ss:Type="${type}">${escapeXml(text)}</Data></Cell>`;
        })
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Export">
  <Table>
   <Row>${headerCells}</Row>
   ${bodyRows}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8;" });
  downloadBlob(blob, filename);
}
