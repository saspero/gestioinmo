// PDF d'un informe de la pestanya Informes: A4 apaïsat, taula amb capçalera repetida a cada
// pàgina, imports alineats a la dreta, fila de totals i número de pàgina. Fet amb pdf-lib i
// les fonts estàndard (Helvetica), que només admeten el joc de caràcters WinAnsi.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { formatValor, type ColumnaInforme, type ResultatInforme } from '../../../lib/validations/informes';

const AMPLADA = 842;
const ALCADA = 595;
const MARGE = 36;
const MIDA = 8;
const ALCADA_FILA = 14;

/** Substitueix els caràcters que Helvetica (WinAnsi) no pot escriure. */
function textPdf(text: string): string {
  return text
    .replace(/[−‐‑]/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g, '?');
}

function retalla(text: string, font: PDFFont, amplada: number): string {
  if (font.widthOfTextAtSize(text, MIDA) <= amplada) return text;
  let retallat = text;
  while (retallat.length > 1 && font.widthOfTextAtSize(`${retallat}…`, MIDA) > amplada) {
    retallat = retallat.slice(0, -1);
  }
  return `${retallat}…`;
}

const alineaDreta = (columna: ColumnaInforme) => columna.tipus !== 'text' && columna.tipus !== 'data';

/** Amplades: fixes per a dates i nombres, i la resta repartida entre les columnes de text. */
function amplades(columnes: ColumnaInforme[]): number[] {
  const fixa: Record<string, number> = { import: 72, data: 62, numero: 50, percentatge: 52 };
  const disponible = AMPLADA - 2 * MARGE;
  const ocupat = columnes.reduce((suma, c) => suma + (fixa[c.tipus] ?? 0), 0);
  const textos = columnes.filter((c) => c.tipus === 'text').length;
  const perText = textos > 0 ? Math.max(60, (disponible - ocupat) / textos) : 0;
  return columnes.map((c) => fixa[c.tipus] ?? perText);
}

export async function informeAPdf(
  titol: string,
  subtitol: string,
  resultat: ResultatInforme
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(textPdf(titol));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const negreta = await doc.embedFont(StandardFonts.HelveticaBold);
  const ample = amplades(resultat.columnes);
  const gris = rgb(0.45, 0.45, 0.45);
  const linia = rgb(0.85, 0.85, 0.85);

  const pagines: PDFPage[] = [];
  let pagina!: PDFPage;
  let y = 0;

  const fila = (valors: string[], lletra: PDFFont) => {
    let x = MARGE;
    resultat.columnes.forEach((columna, index) => {
      const espai = ample[index] - 6;
      const text = retalla(textPdf(valors[index] ?? ''), lletra, espai);
      const dx = alineaDreta(columna) ? espai - lletra.widthOfTextAtSize(text, MIDA) : 0;
      pagina.drawText(text, { x: x + dx, y, size: MIDA, font: lletra });
      x += ample[index];
    });
    y -= ALCADA_FILA;
  };

  const novaPagina = () => {
    pagina = doc.addPage([AMPLADA, ALCADA]);
    pagines.push(pagina);
    y = ALCADA - MARGE;
    if (pagines.length === 1) {
      pagina.drawText(textPdf(titol), { x: MARGE, y: y - 6, size: 14, font: negreta });
      y -= 22;
      pagina.drawText(textPdf(subtitol), { x: MARGE, y, size: MIDA, font, color: gris });
      y -= 20;
    }
    fila(resultat.columnes.map((c) => c.label), negreta);
    pagina.drawLine({
      start: { x: MARGE, y: y + ALCADA_FILA - 4 },
      end: { x: AMPLADA - MARGE, y: y + ALCADA_FILA - 4 },
      thickness: 0.5,
      color: linia,
    });
  };

  novaPagina();
  if (resultat.files.length === 0) {
    pagina.drawText('Cap resultat amb aquests filtres.', { x: MARGE, y, size: MIDA, font, color: gris });
  }
  for (const valors of resultat.files) {
    if (y < MARGE + ALCADA_FILA) novaPagina();
    fila(resultat.columnes.map((c) => formatValor(valors[c.id], c.tipus)), font);
  }
  if (resultat.totals) {
    if (y < MARGE + ALCADA_FILA) novaPagina();
    pagina.drawLine({
      start: { x: MARGE, y: y + ALCADA_FILA - 4 },
      end: { x: AMPLADA - MARGE, y: y + ALCADA_FILA - 4 },
      thickness: 0.5,
      color: linia,
    });
    const totals = resultat.totals;
    fila(
      resultat.columnes.map((c, index) =>
        index === 0 ? 'Total' : c.id in totals ? formatValor(totals[c.id], c.tipus) : ''
      ),
      negreta
    );
  }

  pagines.forEach((p, index) => {
    const peu = `Gestinmo · Pàgina ${index + 1} de ${pagines.length}`;
    p.drawText(textPdf(peu), {
      x: AMPLADA - MARGE - font.widthOfTextAtSize(textPdf(peu), 7),
      y: MARGE / 2,
      size: 7,
      font,
      color: gris,
    });
  });

  return doc.save();
}
