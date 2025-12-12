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
