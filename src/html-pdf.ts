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
  clientTaxId?: string | null;
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
  // Adjusted container style with smaller font sizes and more spacing
  containerDiv.style.cssText =
    "font-family: Arial, sans-serif; position: fixed; left: -9999px; top: -9999px; width: 595px; height: 842px; padding: 40px; margin: 0; box-sizing: border-box; font-size: 10px; line-height: 1.4; display: flex; flex-direction: column; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;";

  // Get currency symbol from settings or default to Euro
  const currencySymbol = businessSettings?.currency
    ? getCurrencySymbol(businessSettings.currency)
    : "€";

  // Format date in a clear, standardized format: DD/MM/YYYY
  let formattedDate = "";
  try {
    // If we couldn't format it with special handling, try standard date parsing
    if (!formattedDate) {
      const dateObj = new Date(invoice.header.date);
      if (!isNaN(dateObj.getTime())) {
        // Format as DD/MM/YYYY for clear readability
        const day = dateObj.getDate().toString().padStart(2, "0");
        const month = (dateObj.getMonth() + 1).toString().padStart(2, "0");
        const year = dateObj.getFullYear();
        formattedDate = `${day}/${month}/${year}`;
      } else {
        // If we can't parse the date at all, use a simple string conversion if possible
        const rawDate = invoice.header.date || "";
        if (rawDate.includes("-")) {
          // Simple conversion from YYYY-MM-DD to DD/MM/YYYY
          const parts = rawDate.split("-");
          if (parts.length === 3) {
            formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
          } else {
            formattedDate = rawDate;
          }
        } else {
          formattedDate = rawDate;
        }
      }
    }
  } catch (error) {
    console.error("Error formatting date:", error);
    formattedDate = invoice.header.date || ""; // Use original as fallback
  }

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
              ? `<h1 class="text-2xl font-bold mb-3">${businessSettings.businessName}</h1>`
              : ""
          }
          ${
            businessSettings?.tradingName
              ? `<p class="text-base text-gray-600 mb-3">${businessSettings.tradingName}</p>`
              : ""
          }
          ${
            businessSettings?.businessAddress
              ? `<p class="text-sm text-gray-600 whitespace-pre-line mb-3">${businessSettings.businessAddress}</p>`
              : ""
          }
          ${
            businessSettings?.businessPhone
              ? `<p class="text-sm text-gray-600 mb-1">Phone: ${businessSettings.businessPhone}</p>`
              : ""
          }
          ${
            businessSettings?.businessEmail
              ? `<p class="text-sm text-gray-600 mb-1">Email: ${businessSettings.businessEmail}</p>`
              : ""
          }
          ${
            businessSettings?.taxId
              ? `<p class="text-sm text-gray-600 mb-1">Tax ID: ${businessSettings.taxId}</p>`
              : ""
          }
        </div>
        
        <!-- Invoice Info -->
        <div class="w-1/2 text-right">
          <div class="flex flex-col items-end">
            <h2 class="text-3xl font-bold text-blue-600 mb-5">INVOICE</h2>
            <!-- PAID and LOCKED labels removed from PDF -->
          </div>
          <p class="text-base mb-2"><span class="text-gray-600">Invoice #:</span> ${
            invoice.header.number
          }</p>
          <p class="text-base mb-2"><span class="text-gray-600">Date:</span> ${formattedDate}</p>
          ${
            businessSettings?.paymentTerms
              ? `<p class="text-sm text-gray-600 mb-2">Terms: ${businessSettings.paymentTerms}</p>`
              : ""
          }
        </div>
      </div>
      
      <!-- Client Info with improved spacing -->
      <div class="mb-8 p-4 bg-gray-50 rounded" style="flex: 0 0 auto;">
        <h3 class="text-base font-semibold text-gray-700 mb-2">Bill To</h3>
        <p class="text-base">${invoice.header.client}</p>
        ${invoice.header.clientTaxId ? `<p class="text-sm text-gray-600 mt-1">Tax ID: ${invoice.header.clientTaxId}</p>` : ''}
      </div>
      
      <!-- Main Content Area - Grows to Fill Space -->
      <div style="flex: 1 1 auto; display: flex; flex-direction: column;">
        <!-- Items Table -->
        <table class="w-full mb-8" style="flex: 1 0 auto;">
          <thead>
            <tr class="bg-gray-100 text-left">
              <th class="p-3 border-b-2 border-gray-300 w-1/2 text-sm font-medium">Description</th>
              <th class="p-3 border-b-2 border-gray-300 text-center text-sm font-medium">Qty</th>
              <th class="p-3 border-b-2 border-gray-300 text-right text-sm font-medium">Unit Price</th>
              <th class="p-3 border-b-2 border-gray-300 text-right text-sm font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items
              // Filter out empty rows or rows with no description or zero values
              .filter(
                (item) =>
                  item.description &&
                  item.description.trim() !== "" &&
                  (item.qty > 0 || item.unit > 0)
              )
              .map(
                (item) => `
              <tr class="border-b border-gray-200">
                <td class="p-3 text-sm">${item.description}</td>
                <td class="p-3 text-center text-sm">${item.qty}</td>
                <td class="p-3 text-right text-sm">${currencySymbol}${item.unit.toFixed(
                  2
                )}</td>
                <td class="p-3 text-right text-sm">${currencySymbol}${(
                  item.qty * item.unit
                ).toFixed(2)}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
        
        <!-- Totals -->
        <div class="flex justify-end mb-8" style="flex: 0 0 auto;">
          <div class="w-1/3">
            <div class="flex justify-between border-b border-gray-200 py-2">
              <span class="font-semibold text-sm">Subtotal:</span>
              <span class="text-sm">${currencySymbol}${subtotal.toFixed(
    2
  )}</span>
            </div>
            ${
              businessSettings?.taxRate
                ? `
            <div class="flex justify-between border-b border-gray-200 py-2">
              <span class="font-semibold text-sm">Tax (${taxRate}%):</span>
              <span class="text-sm">${currencySymbol}${taxAmount.toFixed(
                    2
                  )}</span>
            </div>
            `
                : ""
            }
            <div class="flex justify-between py-2 font-bold mt-1">
              <span class="text-base">Total:</span>
              <span class="text-base">${currencySymbol}${invoice.header.total.toFixed(
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
            <h3 class="text-base font-semibold text-gray-700 mb-3">Payment Details</h3>
            ${
              businessSettings?.bankName
                ? `<p class="text-sm mb-2"><span class="font-semibold">Bank:</span> ${businessSettings.bankName}</p>`
                : ""
            }
            ${
              businessSettings?.accountName
                ? `<p class="text-sm mb-2"><span class="font-semibold">Account Name:</span> ${businessSettings.accountName}</p>`
                : ""
            }
            ${
              businessSettings?.accountNumber
                ? `<p class="text-sm mb-2"><span class="font-semibold">IBAN/Account:</span> ${businessSettings.accountNumber}</p>`
                : ""
            }
            ${
              businessSettings?.swiftCode
                ? `<p class="text-sm mb-2"><span class="font-semibold">SWIFT/BIC:</span> ${businessSettings.swiftCode}</p>`
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
            <h3 class="text-base font-semibold text-gray-700 mb-2">Notes</h3>
            <p class="text-sm text-gray-600 whitespace-pre-line">${businessSettings.invoiceNote}</p>
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

    // FIXED APPROACH: Use higher DPI to prevent blurry text, while maintaining proper zoom
    const canvasSettings = {
      scale: 3, // Higher scale for better text quality, without affecting zoom
      useCORS: true,
      logging: false,
      allowTaint: true,
      backgroundColor: "#ffffff",
      width: 595, // A4 width in points (72 DPI)
      height: 842, // A4 height in points (72 DPI)
      // Improve text rendering quality
      imageTimeout: 0,
      letterRendering: true,
    };

    // Make sure the div is fully rendered before conversion
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Convert HTML to canvas with appropriate quality
    const canvas = await html2canvas(invoiceDiv, canvasSettings);

    // Remove the temporary div
    document.body.removeChild(invoiceDiv);

    // Create PDF document with A4 dimensions
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size

    // Create a variable for the image that will be in scope for the whole function
    let image;

    try {
      // Always use PNG for better text clarity - important for crisp text
      const imgData = canvas.toDataURL("image/png", 1.0);
      const base64Data = imgData.replace(/^data:image\/png;base64,/, "");
      const pngImageBytes = Uint8Array.from(atob(base64Data), (c) =>
        c.charCodeAt(0)
      );

      // Embed PNG for maximum text clarity
      image = await pdfDoc.embedPng(pngImageBytes);
    } catch (error) {
      console.error("Error creating PDF image from PNG:", error);

      // Fallback to JPEG if PNG fails, but with high quality setting
      try {
        // Use highest JPEG quality to maintain text clarity
        const imgData = canvas.toDataURL("image/jpeg", 1.0);
        const base64Data = imgData.replace(/^data:image\/jpeg;base64,/, "");
        const jpgImageBytes = Uint8Array.from(atob(base64Data), (c) =>
          c.charCodeAt(0)
        );
        image = await pdfDoc.embedJpg(jpgImageBytes);
      } catch (fallbackError) {
        console.error("Both PNG and JPEG embedding failed:", fallbackError);
        throw new Error("Failed to create PDF: Image embedding failed");
      }
    }

    // Draw the image on PDF page - direct 1:1 mapping
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
