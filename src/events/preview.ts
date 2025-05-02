import { buildPdf } from '../pdf.ts';
import { buildHtmlPdf } from '../html-pdf.ts';
import { $ } from '../ui.ts';
import { getBusinessSettings } from '../db.ts';

// Define interfaces for the invoice object
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
}

interface Invoice {
  header: InvoiceHeader;
  items: InvoiceItem[];
}

// Live preview of invoice while editing
export async function updateInvoicePreview(): Promise<void> {
  try {
    // Get business settings
    const businessSettings = await getBusinessSettings();

    const form = $('#invoice-form') as HTMLFormElement;
    const fd = new FormData(form);
    const number = fd.get('number') as string;
    const date = fd.get('date') as string;
    const clientSelect = form.elements.namedItem('clientId') as HTMLSelectElement;
    const clientName = clientSelect.options[clientSelect.selectedIndex]?.text || '';
    const rows = Array.from(($('#items-table tbody') as HTMLTableSectionElement).rows);
    const items = rows.map((r) => ({
      description: (r.querySelector('[name="description"]') as HTMLInputElement).value || '',
      qty: Number((r.querySelector('[name="qty"]') as HTMLInputElement).value || 0),
      unit: Number((r.querySelector('[name="unit"]') as HTMLInputElement).value || 0),
    }));
    const total = items.reduce((sum, it) => sum + it.qty * it.unit, 0);
    const invoiceObj: Invoice = {
      header: {
        number,
        date: date || new Date().toISOString().split('T')[0],
        client: clientName,
        total
      },
      items
    };

    const previewEl = $('#invoice-preview') as HTMLIFrameElement;
    if (previewEl) {
      // Add a timestamp to prevent caching issues with the iframe
      previewEl.onload = () => {
        // Make sure the iframe content is centered properly
        try {
          const iframeDoc = previewEl.contentDocument || (previewEl.contentWindow as Window).document;
          if (iframeDoc && iframeDoc.body) {
            iframeDoc.body.style.margin = '0';
            iframeDoc.body.style.padding = '0';
            iframeDoc.body.style.display = 'flex';
            iframeDoc.body.style.justifyContent = 'center';
            iframeDoc.body.style.alignItems = 'flex-start';
          }
        } catch (e) {
          console.error('Unable to style iframe body:', e);
        }
      };

      await buildHtmlPdf(invoiceObj, {
        previewEl,
        open: false,
        businessSettings,
        previewMode: true
      });
    }
  } catch (error) {
    console.error('Error updating invoice preview:', error);
  }
}