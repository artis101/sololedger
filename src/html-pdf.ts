import { PDFDocument } from "pdf-lib";
import html2canvas from "html2canvas";

// Define interface for invoice and business settings
interface InvoiceItem {
  description: string;
  qty: number;
  unit: number;
}

interface InvoiceHeader {
  number: string;
  date: string;
  client: string;
  total: number;
  paid?: number;
  locked?: number;
}

interface Invoice {
  header: InvoiceHeader;
  items: InvoiceItem[];
}

interface BusinessSettings {
  businessName?: string;
  tradingName?: string;
  businessAddress?: string;
  businessEmail?: string;
  businessPhone?: string;
  taxId?: string;
  taxRate?: number | string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  swiftCode?: string;
  currency?: string;
  paymentTerms?: string;
  invoiceNote?: string;
  lastUpdated?: string;
  [key: string]: any;
}

interface BuildHtmlPdfOptions {
  previewEl?: HTMLIFrameElement | null;
  open?: boolean;
  businessSettings?: BusinessSettings | null;
  previewMode?: boolean;
}

// Helper function to get currency symbol
export function getCurrencySymbol(currencyCode: string): string {
  switch (currencyCode) {
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    default:
      return currencyCode;
  }
}

// Create and render HTML invoice template with the provided data
export function createInvoiceHTML(
  invoice: Invoice,
  businessSettings?: BusinessSettings | null
): HTMLDivElement {
  // Create a container div for the invoice
  const containerDiv = document.createElement("div");
  containerDiv.id = "invoice-html-template";
  containerDiv.className = "bg-white p-8";
  containerDiv.style.cssText =
    "font-family: Roboto, Arial, sans-serif; position: fixed; left: -9999px; top: -9999px; width: 210mm; height: 297mm; box-sizing: border-box; font-size: 12px;";

  // Get currency symbol from settings or default to Euro
  const currencySymbol = businessSettings?.currency
    ? getCurrencySymbol(businessSettings.currency)
    : "€";

  // Format date
  const formattedDate = new Date(invoice.header.date).toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );

  // Calculate subtotal and tax if we have a tax rate
  let taxRate = 0;
  let taxAmount = 0;
  let subtotal = invoice.header.total;

  if (businessSettings?.taxRate) {
    taxRate = parseFloat(businessSettings.taxRate.toString());
    subtotal = invoice.header.total / (1 + taxRate / 100);
    taxAmount = invoice.header.total - subtotal;
  }

  // Generate HTML content with responsive layout
  containerDiv.innerHTML = `
    <div style="height: 100%; display: flex; flex-direction: column;">
      <!-- Header Section -->
      <div class="flex justify-between items-start mb-6" style="flex: 0 0 auto;">
        <!-- Company Info -->
        <div class="w-1/2">
          ${
            businessSettings?.businessName
              ? `<h1 class="text-3xl font-bold mb-2">${businessSettings.businessName}</h1>`
              : ""
          }
          ${
            businessSettings?.tradingName
              ? `<p class="text-xl text-gray-600 mb-2">${businessSettings.tradingName}</p>`
              : ""
          }
          ${
            businessSettings?.businessAddress
              ? `<p class="text-base text-gray-600 whitespace-pre-line">${businessSettings.businessAddress}</p>`
              : ""
          }
          ${
            businessSettings?.businessPhone
              ? `<p class="text-base text-gray-600 mt-1">Phone: ${businessSettings.businessPhone}</p>`
              : ""
          }
          ${
            businessSettings?.businessEmail
              ? `<p class="text-base text-gray-600">Email: ${businessSettings.businessEmail}</p>`
              : ""
          }
          ${
            businessSettings?.taxId
              ? `<p class="text-base text-gray-600">Tax ID: ${businessSettings.taxId}</p>`
              : ""
          }
        </div>
        
        <!-- Invoice Info -->
        <div class="w-1/2 text-right">
          <div class="flex flex-col items-end">
            <h2 class="text-4xl font-bold text-blue-600 mb-4">INVOICE</h2>
            ${
              invoice.header.paid
                ? `<div class="mb-4 -mt-3 inline-block bg-green-100 text-green-800 px-4 py-1 rounded-lg border-2 border-green-300 transform rotate-1">
                <span class="text-xl font-bold">PAID</span>
              </div>`
                : ""
            }
            ${
              invoice.header.locked
                ? `<div class="mb-4 -mt-3 ${
                    invoice.header.paid ? "ml-2" : ""
                  } inline-block bg-red-100 text-red-800 px-4 py-1 rounded-lg border-2 border-red-300 transform rotate-1">
                <span class="text-xl font-bold">🔒 LOCKED</span>
              </div>`
                : ""
            }
          </div>
          <p class="text-xl mb-1"><span class="text-gray-600">Invoice #:</span> ${
            invoice.header.number
          }</p>
          <p class="text-xl mb-1"><span class="text-gray-600">Date:</span> ${formattedDate}</p>
          ${
            businessSettings?.paymentTerms
              ? `<p class="text-base text-gray-600 mb-1">Terms: ${businessSettings.paymentTerms}</p>`
              : ""
          }
        </div>
      </div>
      
      <!-- Client Info -->
      <div class="mb-6 p-4 bg-gray-50 rounded" style="flex: 0 0 auto;">
        <h3 class="text-xl font-semibold text-gray-700 mb-2">Bill To</h3>
        <p class="text-xl">${invoice.header.client}</p>
      </div>
      
      <!-- Main Content Area - Grows to Fill Space -->
      <div style="flex: 1 1 auto; display: flex; flex-direction: column;">
        <!-- Items Table -->
        <table class="w-full mb-6" style="flex: 1 0 auto;">
          <thead>
            <tr class="bg-gray-100 text-left">
              <th class="p-3 border-b-2 border-gray-300 w-1/2 text-lg">Description</th>
              <th class="p-3 border-b-2 border-gray-300 text-center text-lg">Qty</th>
              <th class="p-3 border-b-2 border-gray-300 text-right text-lg">Unit Price</th>
              <th class="p-3 border-b-2 border-gray-300 text-right text-lg">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items
              .map(
                (item) => `
              <tr class="border-b border-gray-200">
                <td class="p-3 text-base">${item.description}</td>
                <td class="p-3 text-center text-base">${item.qty}</td>
                <td class="p-3 text-right text-base">${currencySymbol}${item.unit.toFixed(
                  2
                )}</td>
                <td class="p-3 text-right text-base">${currencySymbol}${(
                  item.qty * item.unit
                ).toFixed(2)}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
        
        <!-- Totals -->
        <div class="flex justify-end mb-6" style="flex: 0 0 auto;">
          <div class="w-1/3">
            <div class="flex justify-between border-b border-gray-200 py-2">
              <span class="font-semibold text-lg">Subtotal:</span>
              <span class="text-lg">${currencySymbol}${subtotal.toFixed(
    2
  )}</span>
            </div>
            ${
              businessSettings?.taxRate
                ? `
            <div class="flex justify-between border-b border-gray-200 py-2">
              <span class="font-semibold text-lg">Tax (${taxRate}%):</span>
              <span class="text-lg">${currencySymbol}${taxAmount.toFixed(
                    2
                  )}</span>
            </div>
            `
                : ""
            }
            <div class="flex justify-between py-2 font-bold">
              <span class="text-xl">Total:</span>
              <span class="text-xl">${currencySymbol}${invoice.header.total.toFixed(
    2
  )}</span>
            </div>
          </div>
        </div>
        
        <!-- Footer Section -->
        <div style="flex: 0 0 auto; margin-top: auto;">
          <!-- Payment Info -->
          ${
            businessSettings?.bankName || businessSettings?.accountNumber
              ? `
          <div class="mb-6 p-4 bg-gray-50 rounded">
            <h3 class="text-xl font-semibold text-gray-700 mb-2">Payment Details</h3>
            ${
              businessSettings?.bankName
                ? `<p class="text-base mb-1"><span class="font-semibold">Bank:</span> ${businessSettings.bankName}</p>`
                : ""
            }
            ${
              businessSettings?.accountName
                ? `<p class="text-base mb-1"><span class="font-semibold">Account Name:</span> ${businessSettings.accountName}</p>`
                : ""
            }
            ${
              businessSettings?.accountNumber
                ? `<p class="text-base mb-1"><span class="font-semibold">IBAN/Account:</span> ${businessSettings.accountNumber}</p>`
                : ""
            }
            ${
              businessSettings?.swiftCode
                ? `<p class="text-base mb-1"><span class="font-semibold">SWIFT/BIC:</span> ${businessSettings.swiftCode}</p>`
                : ""
            }
          </div>
          `
              : ""
          }
          
          <!-- Notes -->
          ${
            businessSettings?.invoiceNote
              ? `
          <div class="border-t border-gray-200 pt-4">
            <h3 class="text-xl font-semibold text-gray-700 mb-2">Notes</h3>
            <p class="text-base text-gray-600 whitespace-pre-line">${businessSettings.invoiceNote}</p>
          </div>
          `
              : ""
          }
          
          <!-- Community Edition Badge -->
          <div class="mt-8 pt-4 text-center opacity-60">
            <p class="text-[9px] text-gray-500">
              <span class="inline-flex items-center gap-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-2 w-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2L4.5 10 8 10 8 22 16 22 16 10 19.5 10z" />
                </svg>
                Generated with SoloLedger Community Edition • AGPL-3.0
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>`;

  // Append to body temporarily (will be removed later)
  document.body.appendChild(containerDiv);
  return containerDiv;
}

export async function buildHtmlPdf(
  invoice: Invoice,
  options: BuildHtmlPdfOptions = {}
): Promise<string> {
  const {
    previewEl = null,
    open = true,
    businessSettings = null,
    previewMode = false,
  } = options;

  try {
    // Create the HTML invoice
    const invoiceDiv = createInvoiceHTML(invoice, businessSettings);

    // Wait a moment for styles to apply
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Configure canvas settings based on mode
    const canvasSettings = {
      scale: previewMode ? 1.5 : 3, // Lower scale for preview to improve performance
      useCORS: true,
      logging: false,
      allowTaint: true,
      backgroundColor: "#ffffff",
      width: 595, // A4 width in points at 72 DPI
      height: 842, // A4 height in points at 72 DPI
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
      // Make PDF look better
      letterRendering: true,
      foreignObjectRendering: false, // Use the slower but more accurate canvas rendering
    };

    // Convert HTML to canvas with appropriate quality
    const canvas = await html2canvas(invoiceDiv, canvasSettings);

    // Remove the temporary div
    document.body.removeChild(invoiceDiv);

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size in points at 72 DPI

    // Convert canvas to image with appropriate quality based on mode
    const imageQuality = previewMode ? 0.85 : 1.0;
    const imgFormat = previewMode ? "image/png" : "image/jpeg"; // PNG for preview for better text clarity
    const imgData = canvas.toDataURL(imgFormat, imageQuality);

    // Remove the data URL prefix to get just the base64 data
    const base64Data = imgData.replace(/^data:image\/(png|jpeg);base64,/, "");

    // Embed the image in the PDF using the appropriate method
    let image;
    if (previewMode) {
      const pngImageBytes = Uint8Array.from(atob(base64Data), (c) =>
        c.charCodeAt(0)
      );
      image = await pdfDoc.embedPng(pngImageBytes);
    } else {
      const jpgImageBytes = Uint8Array.from(atob(base64Data), (c) =>
        c.charCodeAt(0)
      );
      image = await pdfDoc.embedJpg(jpgImageBytes);
    }

    // Draw the image on the PDF using the full page
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: page.getWidth(),
      height: page.getHeight(),
    });

    // Save the PDF with appropriate compression
    const pdfBytes = await pdfDoc.save({
      useObjectStreams: !previewMode, // More compression for final PDFs, less for previews
    });

    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    // Display or open the PDF
    if (previewEl) {
      // Add a cache-busting parameter to prevent stale previews
      previewEl.src = url + "#t=" + new Date().getTime();
    }

    if (open) {
      window.open(url, "_blank");
    }

    return url;
  } catch (error) {
    console.error("Error generating PDF from HTML:", error);
    throw error;
  }
}
