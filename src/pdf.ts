import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { BusinessSettings } from "./types";

interface PdfOptions {
  previewEl?: HTMLIFrameElement | null;
  open?: boolean;
  businessSettings?: BusinessSettings | null;
}

interface InvoiceHeader {
  number: string;
  date: string;
  client: string;
  total: number;
}

interface InvoiceItem {
  description: string;
  qty: number;
  unit: number;
}

interface InvoiceData {
  header: InvoiceHeader;
  items: InvoiceItem[];
}

// URL of a TrueType font that supports UTF-8 (Open Sans)
const FONT_URL =
  "https://fonts.gstatic.com/s/opensans/v20/mem8YaGs126MiZpBA-UFVp0e.ttf";
// Cache for fetched font bytes
let fontBytesPromise: Promise<ArrayBuffer> | undefined;

async function fetchFontBytes(): Promise<ArrayBuffer> {
  if (!fontBytesPromise) {
    fontBytesPromise = fetch(FONT_URL).then((res) => {
      if (!res.ok) throw new Error("Failed to load font: " + res.status);
      return res.arrayBuffer();
    });
  }
  return fontBytesPromise;
}

// Helper function to get currency symbol from currency code
function getCurrencySymbol(currencyCode: string): string {
  switch (currencyCode) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    default: return currencyCode;
  }
}

export async function buildPdf(
  invoice: InvoiceData,
  { previewEl = null, open = true, businessSettings = null }: PdfOptions = {}
): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  // Register fontkit to embed custom fonts for UTF-8 support
  pdfDoc.registerFontkit(fontkit);
  const page = pdfDoc.addPage([595.28, 841.89]);
  // Embed a Unicode TrueType font for UTF-8 support
  const fontBytes = await fetchFontBytes();
  const font = await pdfDoc.embedFont(fontBytes, { subset: true });

  // Get currency symbol from settings or default to Euro
  const currencySymbol = businessSettings?.currency ?
    getCurrencySymbol(businessSettings.currency) :
    '€';

  // Business information section (top left)
  if (businessSettings) {
    let yBusiness = 800;
    const businessName = businessSettings.businessName || 'Your Business';
    page.drawText(businessName, {
      x: 50,
      y: yBusiness,
      size: 16,
      font,
    });
    yBusiness -= 16;

    if (businessSettings.tradingName) {
      page.drawText(businessSettings.tradingName, {
        x: 50,
        y: yBusiness,
        size: 12,
        font,
      });
      yBusiness -= 14;
    }

    if (businessSettings.businessAddress) {
      // Split address into lines
      const addressLines = businessSettings.businessAddress.split('\n');
      for (const line of addressLines) {
        page.drawText(line, {
          x: 50,
          y: yBusiness,
          size: 10,
          font,
        });
        yBusiness -= 12;
      }
    }

    // Contact info
    if (businessSettings.businessEmail) {
      page.drawText(`Email: ${businessSettings.businessEmail}`, {
        x: 50,
        y: yBusiness,
        size: 10,
        font,
      });
      yBusiness -= 12;
    }

    if (businessSettings.businessPhone) {
      page.drawText(`Phone: ${businessSettings.businessPhone}`, {
        x: 50,
        y: yBusiness,
        size: 10,
        font,
      });
      yBusiness -= 12;
    }

    // Tax info
    if (businessSettings.taxId) {
      page.drawText(`Tax ID: ${businessSettings.taxId}`, {
        x: 50,
        y: yBusiness,
        size: 10,
        font,
      });
    }
  }

  // Invoice details (top right)
  page.drawText(`INVOICE`, {
    x: 400,
    y: 800,
    size: 18,
    font,
  });

  page.drawText(`Invoice #: ${invoice.header.number}`, {
    x: 400,
    y: 780,
    size: 12,
    font,
  });

  page.drawText(`Date: ${invoice.header.date}`, {
    x: 400,
    y: 765,
    size: 12,
    font,
  });

  // Payment terms if available
  if (businessSettings?.paymentTerms) {
    page.drawText(`Terms: ${businessSettings.paymentTerms}`, {
      x: 400,
      y: 750,
      size: 12,
      font,
    });
  }

  // Bill To section
  let yClient = 710;
  page.drawText(`Bill To:`, {
    x: 50,
    y: yClient,
    size: 12,
    font,
  });
  yClient -= 15;

  page.drawText(`${invoice.header.client}`, {
    x: 50,
    y: yClient,
    size: 12,
    font,
  });

  // If we have client address in the future, we could add it here

  // Invoice items table
  let y = 650;

  // Table header
  page.drawText(`Description`, { x: 50, y, size: 11, font });
  page.drawText(`Qty`, { x: 300, y, size: 11, font });
  page.drawText(`Unit Price`, { x: 350, y, size: 11, font });
  page.drawText(`Amount`, { x: 490, y, size: 11, font });

  y -= 10;
  page.drawLine({
    start: { x: 50, y },
    end: { x: 545, y },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
  y -= 20;

  // Table items
  for (const it of invoice.items) {
    page.drawText(it.description, { x: 50, y, size: 11, font });
    page.drawText(String(it.qty), { x: 300, y, size: 11, font });
    page.drawText(`${it.unit.toFixed(2)} ${currencySymbol}`, { x: 350, y, size: 11, font });
    page.drawText(`${(it.qty * it.unit).toFixed(2)} ${currencySymbol}`, {
      x: 490,
      y,
      size: 11,
      font,
    });
    y -= 18;
  }

  // Total section
  y -= 10;
  page.drawLine({
    start: { x: 50, y },
    end: { x: 545, y },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
  y -= 20;

  page.drawText(`Total: ${invoice.header.total.toFixed(2)} ${currencySymbol}`, {
    x: 450,
    y,
    size: 14,
    font,
  });

  // Payment details
  if (businessSettings) {
    y -= 40;
    page.drawText(`Payment Details:`, {
      x: 50,
      y,
      size: 12,
      font,
    });
    y -= 15;

    if (businessSettings.bankName) {
      page.drawText(`Bank: ${businessSettings.bankName}`, {
        x: 50,
        y,
        size: 10,
        font,
      });
      y -= 12;
    }

    if (businessSettings.accountName) {
      page.drawText(`Account Name: ${businessSettings.accountName}`, {
        x: 50,
        y,
        size: 10,
        font,
      });
      y -= 12;
    }

    if (businessSettings.accountNumber) {
      page.drawText(`IBAN/Account: ${businessSettings.accountNumber}`, {
        x: 50,
        y,
        size: 10,
        font,
      });
      y -= 12;
    }

    if (businessSettings.swiftCode) {
      page.drawText(`SWIFT/BIC: ${businessSettings.swiftCode}`, {
        x: 50,
        y,
        size: 10,
        font,
      });
      y -= 12;
    }
  }

  // Notes
  if (businessSettings?.invoiceNote) {
    y -= 20;
    page.drawText(`Notes:`, {
      x: 50,
      y,
      size: 12,
      font,
    });
    y -= 15;

    // Split note into lines if it's long
    const noteLines = businessSettings.invoiceNote.split('\n');
    for (const line of noteLines) {
      if (line.trim()) {
        page.drawText(line, {
          x: 50,
          y,
          size: 10,
          font,
        });
        y -= 12;
      }
    }
  }

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