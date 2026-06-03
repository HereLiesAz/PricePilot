/**
 * Parse bulk-import text (CSV or JSON) into normalized rows. Network-free and
 * pure so it is unit-testable. Phase 1 keeps column mapping simple; the
 * Claude-assisted mapping in PLAN.md arrives in a later phase.
 */

export interface ImportRow {
  url?: string;
  title?: string;
  targetPrice?: number;
  qty?: number;
  notes?: string;
}

export function parseImport(format: "csv" | "json", data: string): ImportRow[] {
  return format === "json" ? parseJson(data) : parseCsv(data);
}

function parseJson(data: string): ImportRow[] {
  const parsed: unknown = JSON.parse(data);
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  return arr.map(normalizeRow).filter(isUsable);
}

function parseCsv(data: string): ImportRow[] {
  const lines = data
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const header = splitCsvLine(lines[0]!).map((h) => h.toLowerCase().trim());
  const hasHeader = header.some((h) =>
    ["url", "title", "name", "targetprice", "target_price", "qty", "quantity", "notes"].includes(h),
  );

  const rows: ImportRow[] = [];
  const startIndex = hasHeader ? 1 : 0;
  for (let i = startIndex; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    const record: Record<string, string> = {};
    if (hasHeader) {
      header.forEach((key, idx) => {
        record[key] = cells[idx] ?? "";
      });
    } else {
      // Headerless: a single column of URLs or titles.
      const value = cells[0] ?? "";
      record[/^https?:\/\//i.test(value) ? "url" : "title"] = value;
    }
    const row = normalizeRow(record);
    if (isUsable(row)) rows.push(row);
  }
  return rows;
}

function normalizeRow(raw: unknown): ImportRow {
  if (raw == null || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const get = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const v = obj[key];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number") return String(v);
    }
    return undefined;
  };

  const targetRaw = get("targetprice", "target_price", "target");
  const qtyRaw = get("qty", "quantity");

  return {
    url: get("url", "link"),
    title: get("title", "name", "product"),
    targetPrice: targetRaw !== undefined ? toNumber(targetRaw) : undefined,
    qty: qtyRaw !== undefined ? toInt(qtyRaw) : undefined,
    notes: get("notes", "note"),
  };
}

function isUsable(row: ImportRow): boolean {
  return Boolean(row.url || row.title);
}

function toNumber(v: string): number | undefined {
  const n = Number.parseFloat(v.replace(/[^0-9.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function toInt(v: string): number | undefined {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Minimal RFC-4180-ish CSV line splitter (handles quoted commas). */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}
