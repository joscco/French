import Papa from 'papaparse';

export function parseCSV(input: string): Record<string, string>[] {
  const cleaned = input.replace(/^\uFEFF/, '');
  const res = Papa.parse<Record<string, string>>(cleaned, {
    delimiter: ';',
    header: true,
    skipEmptyLines: true,
    quoteChar: '"',
  });

  if (res.errors && res.errors.length) {
    console.warn('CSV parse errors', res.errors);
  }

  return (res.data || []).map((row: any) => {
    const rec: Record<string, string> = {};
    Object.entries(row).forEach(([key, value]) => {
      rec[key.trim()] = (value ?? '').toString().trim();
    });
    return rec;
  });
}

function csvEscape(value: unknown): string {
  const s = String(value ?? '');
  // quote if contains delimiter, quote, or newline
  if (/[;"\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export function toCSV(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const header = columns.join(';');
  const lines = rows.map(r => columns.map(c => csvEscape(r[c])).join(';'));
  return [header, ...lines].join('\n') + '\n';
}


export function toNum(v: unknown): number | null {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function toBool(v: unknown): boolean | undefined {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return undefined;
  if (s === 'true' || s === '1' || s === 'yes' || s === 'y') return true;
  if (s === 'false' || s === '0' || s === 'no' || s === 'n') return false;
  return undefined;
}
