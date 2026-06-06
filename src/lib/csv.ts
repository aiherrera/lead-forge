import Papa from "papaparse";

export type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
};

export function parseCsvFile(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const headers = (res.meta.fields ?? []).map((h) => h ?? "");
        resolve({ headers, rows: res.data });
      },
      error: reject,
    });
  });
}

export function toCsv<T extends Record<string, unknown>>(rows: T[], headers?: string[]): string {
  return Papa.unparse(rows, { columns: headers });
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function coerceNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const s = String(v).replace(/[^\d.\-]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function coerceInt(v: unknown): number | null {
  const n = coerceNumber(v);
  return n == null ? null : Math.round(n);
}
