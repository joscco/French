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
  const stringValue = String(value ?? '');
  if (/[;"\n\r]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

export function toCSV(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const header = columns.join(';');
  const lines = rows.map(row => columns.map(col => csvEscape(row[col])).join(';'));
  return [header, ...lines].join('\n') + '\n';
}


export function toNum(value: unknown): number | null {
  const parsedNumber = Number(String(value ?? '').trim());
  return Number.isFinite(parsedNumber) && parsedNumber > 0 ? parsedNumber : null;
}

export function toBool(value: unknown): boolean | undefined {
  const stringValue = String(value ?? '').trim().toLowerCase();
  if (!stringValue) {
    return undefined;
  }
  if (stringValue === 'true' || stringValue === '1' || stringValue === 'yes' || stringValue === 'y') {
    return true;
  }
  if (stringValue === 'false' || stringValue === '0' || stringValue === 'no' || stringValue === 'n') {
    return false;
  }
  return undefined;
}
