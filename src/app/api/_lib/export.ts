// Generació d'exports CSV i PDF sense dependències externes, per a
// `GET /api/informes/[recurs]/export?format=csv|pdf` (docs/agents/AGENT_API.md §2). El
// PDF és intencionadament senzill (una pàgina, Helvetica estàndard, sense llibreries com
// pdfkit — no n'hi ha cap instal·lada encara): document PDF vàlid escrit a mà seguint
// l'especificació mínima (catàleg, pàgina, stream de text, taula xref).

export function buildCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const escapeCell = (value: unknown): string => {
    const text = value === null || value === undefined ? '' : String(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCell(row[header])).join(','));
  }
  return lines.join('\r\n');
}

const MAX_PDF_ROWS = 45;

function escapePdfText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

export function buildSimplePdf(title: string, headers: string[], rows: Array<Record<string, unknown>>): Buffer {
  const truncated = rows.length > MAX_PDF_ROWS;
  const visibleRows = rows.slice(0, MAX_PDF_ROWS);

  const lines: string[] = [title, headers.join(' | '), ''];
  for (const row of visibleRows) {
    lines.push(headers.map((header) => String(row[header] ?? '')).join(' | '));
  }
  if (truncated) {
    lines.push('', `(mostrant els primers ${MAX_PDF_ROWS} de ${rows.length} registres — usa el format CSV per veure'ls tots)`);
  }

  const lineHeight = 12;
  const startY = 780;
  const textCommands = lines
    .map((line, index) => `1 0 0 1 40 ${startY - index * lineHeight} Tm (${escapePdfText(line)}) Tj`)
    .join('\n');
  const streamContent = `BT\n/F1 9 Tf\n${textCommands}\nET`;
  const streamBytes = Buffer.byteLength(streamContent, 'latin1');

  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>',
    `<< /Length ${streamBytes} >>\nstream\n${streamContent}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'latin1');
}
