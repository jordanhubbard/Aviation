export interface CsvTable {
  headers: string[];
  rows: string[][];
}

export function parseCsv(content: string): CsvTable {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  const rows = lines.slice(1).map((line) => parseCsvLine(line));
  return { headers, rows };
}

export function parseCsvRecords(content: string): Array<Record<string, string>> {
  const table = parseCsv(content);
  return table.rows.map((row) => {
    const record: Record<string, string> = {};
    table.headers.forEach((header, index) => {
      record[header] = row[index] ?? "";
    });
    return record;
  });
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  fields.push(current);
  return fields.map((field) => field.trim());
}
