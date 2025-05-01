import { PDFDocument, rgb } from "pdf-lib";

// URL of a TrueType font that supports UTF-8 (Open Sans)
const FONT_URL = 'https://fonts.gstatic.com/s/opensans/v20/mem8YaGs126MiZpBA-UFVp0e.ttf';
// Cache for fetched font bytes
let fontBytesPromise;

async function fetchFontBytes() {
  if (!fontBytesPromise) {
    fontBytesPromise = fetch(FONT_URL).then((res) => {
      if (!res.ok) throw new Error('Failed to load font: ' + res.status);
      return res.arrayBuffer();
    });
  }
  return fontBytesPromise;
}

export async function buildPdf(
  invoice,
  { previewEl = null, open = true } = {}
) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  // Embed a Unicode TrueType font for UTF-8 support
  const fontBytes = await fetchFontBytes();
  const font = await pdfDoc.embedFont(fontBytes, { subset: true });

  page.drawText(`Invoice ${invoice.header.number}`, {
    x: 50,
    y: 770,
    size: 18,
    font,
  });
  page.drawText(`Date: ${invoice.header.date}`, {
    x: 50,
    y: 750,
    size: 12,
    font,
  });
  page.drawText(`Client: ${invoice.header.client}`, {
    x: 50,
    y: 730,
    size: 12,
    font,
  });

  let y = 700;
  page.drawLine({
    start: { x: 50, y },
    end: { x: 545, y },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
  y -= 20;
  for (const it of invoice.items) {
    page.drawText(it.description, { x: 50, y, size: 12, font });
    page.drawText(String(it.qty), { x: 300, y, size: 12, font });
    page.drawText(it.unit.toFixed(2) + " €", { x: 350, y, size: 12, font });
    page.drawText((it.qty * it.unit).toFixed(2) + " €", {
      x: 500,
      y,
      size: 12,
      font,
    });
    y -= 18;
  }
  y -= 10;
  page.drawLine({
    start: { x: 50, y },
    end: { x: 545, y },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
  y -= 20;
  page.drawText(`Total: ${invoice.header.total.toFixed(2)} €`, {
    x: 400,
    y,
    size: 14,
    font,
  });

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  if (previewEl) {
    previewEl.src = url;
  }
  if (open) {
    window.open(url, "_blank");
  }
  return url;
}
