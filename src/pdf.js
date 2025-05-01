import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function buildPdf(invoice) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

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
  window.open(URL.createObjectURL(blob), "_blank");
}